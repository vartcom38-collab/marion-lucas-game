from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from dataclasses import replace
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

VOICE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
OUTPUT_NAME = "visio-lucas-v10a-direct-speaking-candidate.mp4"
GENERATED_NAME = "visio-lucas-v10a-direct-speaking-generated.mp4"
SEED_VC_SPACE = "Plachta/Seed-VC"
LINE = "Salut... ça va, toi ? Qu'est-ce que tu racontes ?"

# Important architecture rule:
# - this file generates ONLY Lucas' remote front-camera feed;
# - the already validated game visio UI (controls, local camera preview, hangup,
#   mic state, etc.) is rendered by src/monia/visio-call-ui.ts at runtime;
# - no call interface is baked into the generated media;
# - the old supplied layout image is NOT reused as a scene.
#
# Lip-sync rule:
# Lucas first speaks natively inside the video generation, exactly as in the
# early successful visio tests. We keep that generated speech timing and mouth
# performance. Instead of replacing it with a separately timed V10-A WAV, we
# convert ONLY the generated speech timbre toward the selected V10-A voice and
# mux it back unchanged in timing. No mouth patch and no video speed warping.


def profile() -> engine.CharacterProfile:
    base = engine.LUCAS_VISIO_TEST1
    prompt = (
        "Create a BRAND-NEW raw remote-camera feed for the already-built Marion & Lucas video-call interface. "
        "This is what Marion receives from Lucas' smartphone front camera during a real private visio call. "
        "Do not draw or bake any call UI, status bar, controls, local-preview window, captions or borders into the video: the game adds those separately. "
        "Do not reproduce any previously supplied scene or background. Invent a fresh believable lived-in interior while preserving Lucas' canonical identity exactly. "
        "Camera grammar: handheld smartphone front camera at normal arm's-length distance, portrait 9:16. "
        "Framing MUST show Lucas from roughly mid/upper torso to above his hair, with both shoulders and a meaningful part of one forearm/upper arm visible. "
        "His head must occupy only the upper part of the image, never the whole frame. This is not a face portrait, headshot, selfie crop or beauty close-up. "
        "The perspective should feel like Lucas is naturally holding the phone during a visio: slight arm-length wide-angle perspective, tiny hand/body sway, minute framing drift, ordinary autofocus/exposure breathing and realistic phone compression. "
        "Lucas remains exactly the validated man: same facial geometry, dark wavy hair, short stubble, olive skin, no tattoos, no facial scar. "
        "His canonical eyes are cool green-hazel / gray-green olive with a subtle amber-brown center and a darker limbal rim; never uniformly brown or clearly blue. "
        "Wardrobe is a simple relaxed dark shirt. Keep natural skin texture and a warm private everyday atmosphere, not cinematic posing. "
        "Lucas is already in conversation with Marion and SPEAKS NATURALLY for almost the whole clip. His mouth, jaw, cheeks, eyes, eyebrows, breathing and tiny head movements must form one coherent real live-action performance. "
        + f"He casually says in native everyday French: {LINE!r}. "
        "Start the utterance almost immediately. Use a tiny natural hesitation after 'Salut', then connected fluent French with relaxed articulation, soft consonants, small reductions and an ordinary intimate sentence melody. "
        "Finish the sentence naturally near the end of the clip. Keep his gaze warm and attentive, alternating subtly between Marion on the screen and the small front-camera lens. "
        "No theatrical acting, no presenter delivery, no exaggerated phoneme acting, no dramatic camera move."
    )
    negative = (
        "copied source scene, reused supplied background, baked phone UI, status bar, call controls, self-view inset, subtitles, captions, borders, "
        "head-only portrait, extreme close-up, face-focused crop, beauty close-up, studio portrait, webcam headshot, centered passport framing, "
        "silent pose, frozen mouth, weak lip movement, tiny lip-only motion, pasted lips, mouth patch, face patch, artificial lip replacement, "
        "over-articulated phonemes, theatrical diction, presenter performance, black borders, tiny centered video, identity drift, changed eyes, "
        "uniformly brown eyes, bright blue eyes, tattoos, second person, cinematic dolly, zoom-in"
    )
    return replace(
        base,
        key="lucas-visio-v10a-direct-speaking-feed",
        prompt=prompt,
        negative=negative,
        width=576,
        height=1024,
        aspect_ratio="9:16 (Portrait)",
        duration=5,
        output_name=GENERATED_NAME,
    )


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def generate_native() -> tuple[Path, str]:
    p = profile()
    source = engine.WORK_DIR / "lucas-visio-v10a-canon.png"
    target = engine.WORK_DIR / p.output_name
    engine._download_canon(p, source)
    target.unlink(missing_ok=True)
    errors: list[str] = []
    try:
        provider = engine._run_ltx(p, source, target)
    except Exception as exc:
        errors.append(f"primary: {exc}")
        target.unlink(missing_ok=True)
        try:
            provider = engine._run_wan(p, source, target)
        except Exception as wexc:
            errors.append(str(wexc))
            raise RuntimeError("No MonIA native speaking video compute available: " + " | ".join(errors)) from wexc
    if not engine.worker.looks_like_video(target):
        raise RuntimeError("Native speaking candidate is not a valid video")
    return target, provider


def extract_native_audio(video: Path, target: Path) -> None:
    target.unlink(missing_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(video), "-vn", "-ac", "1", "-ar", "24000",
            "-af", "highpass=f=55", str(target),
        ],
        check=True,
        timeout=90,
    )
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Generated visio contained no usable native speech audio")


def resolve_seed_vc_audio(result) -> Path:
    candidates = list(reversed(result)) if isinstance(result, (list, tuple)) else [result]
    for item in candidates:
        if isinstance(item, str):
            p = Path(item)
            if p.exists() and p.stat().st_size > 4096:
                return p
        elif isinstance(item, dict):
            raw = item.get("path") or item.get("name")
            if raw:
                p = Path(str(raw))
                if p.exists() and p.stat().st_size > 4096:
                    return p
    raise RuntimeError(f"Seed-VC returned no usable audio file: {type(result).__name__}")


def convert_generated_timing_to_v10a(native_audio: Path, v10a_reference: Path, target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SEED_VC_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(
        source_audio_path=handle_file(native_audio),
        target_audio_path=handle_file(v10a_reference),
        diffusion_steps=30,
        length_adjust=1.0,
        intelligebility_cfg_rate=0.0,
        similarity_cfg_rate=0.72,
        top_p=0.92,
        temperature=0.72,
        repetition_penalty=1.0,
        convert_style=False,
        anonymization_only=False,
        api_name="/predict",
    )
    converted = resolve_seed_vc_audio(result)
    shutil.copyfile(converted, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("V10-A timbre conversion produced no usable audio")
    return "native generated speech timing + Seed-VC V10-A timbre-only conversion"


def mux_timing_locked_voice(video: Path, voice: Path, output: Path) -> None:
    output.unlink(missing_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(video), "-i", str(voice),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest", str(output),
        ],
        check=True,
        timeout=90,
    )
    if not engine.worker.looks_like_video(output):
        raise RuntimeError("Final timing-locked visio is not a valid video")


def build() -> tuple[Path, str]:
    generated, video_provider = generate_native()
    native_audio = engine.WORK_DIR / "lucas-visio-native-timing.wav"
    v10a_reference = engine.WORK_DIR / "lucas-v10a-selected-reference.wav"
    converted_voice = engine.WORK_DIR / "lucas-visio-native-timing-v10a-timbre.wav"
    output = engine.WORK_DIR / OUTPUT_NAME

    extract_native_audio(generated, native_audio)
    download(VOICE_URL, v10a_reference)
    voice_provider = convert_generated_timing_to_v10a(native_audio, v10a_reference, converted_voice)
    mux_timing_locked_voice(generated, converted_voice, output)
    return output, f"{video_provider}; {voice_provider}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a true Lucas visio camera feed with native mouth timing and V10-A timbre")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    output, provider = build()
    print(f"MONIA_VISIO_V10A_DIRECT compute={provider} output={output} bytes={output.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_VISIO_V10A_DIRECT_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
