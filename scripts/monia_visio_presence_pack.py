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

V7_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "visio-lucas-speaking-fr-layout-v7-candidate.mp4?run=34826963016"
)
V10A_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
)
SEED_VC_SPACE = "Plachta/Seed-VC"
WIDTH = 576
HEIGHT = 1024

IDENTITY = (
    "Preserve the exact validated Lucas identity from the supplied V7-derived frame: same facial geometry, dark wavy hair, short stubble, olive skin, no tattoos, no facial scar. "
    "His eyes are canonical cool green-hazel: gray-green/olive outer iris, subtle warm amber-brown center near the pupil and darker limbal rim; never uniformly brown, bright blue or neon green. "
    "Keep the same believable smartphone front-camera grammar, black shirt and warm private-room baseline for this mechanics test. "
    "Upper torso, shoulders and a little forearm remain naturally visible; never turn this into a head-only beauty portrait. "
)
ALIVE = (
    "He must feel continuously alive: natural quiet breathing, irregular blinks, tiny changes of focus between Marion on screen and the lens, minute eye movements, tiny jaw relaxation, small posture settling and subtle handheld/framing drift. "
    "Performance is restrained and private. Reactions start in the eyes before the mouth. No presenter performance, no constant smile, no theatrical gestures. "
)
NEGATIVE = (
    "different man, identity drift, face morphing, tattoos, scar, uniform brown eyes, blue eyes, neon green eyes, head-only crop, extreme close-up, beauty filter, plastic skin, frozen face, blank stare, repeated mechanical blink, exaggerated smile, theatrical acting, big gesture, subtitles, captions, text, UI, watermark, second person, extra hands, cinematic dolly, zoom, lip-sync patch, pasted mouth"
)

SILENT_STATES = {
    "listening": (
        6,
        "STATE: LISTENING. Lucas is silently listening to Marion. His lips stay naturally closed or slightly relaxed with no speech articulation. "
        "He blinks once or twice irregularly, breathes, makes a tiny eye-focus change, briefly glances a few degrees away and returns, and subtly settles one shoulder. "
        "The end pose should be close to the beginning pose so the clip can repeat without an obvious jump."
    ),
    "reaction": (
        3,
        "STATE: SILENT REACTION. Lucas has just heard something mildly warm or interesting. The reaction starts in his eyes, followed by a very small restrained half-smile and a tiny eyebrow or jaw response. "
        "No speaking and no exaggerated grin. Finish in a neutral attentive posture suitable for transitioning into speech."
    ),
    "thinking": (
        4,
        "STATE: THINKING/LISTENING. Lucas stays silent, glances briefly down or to the side as if considering what Marion said, exhales subtly, then returns his gaze toward the screen. "
        "Keep lips quiet and relaxed, no speech articulation."
    ),
}

SPEAKING_STATES = {
    "calm": "Ça va... journée un peu longue, mais tranquille. Et toi, t'as fait quoi ?",
    "warm": "Ah ouais ? Ça me fait plaisir que tu m'appelles juste pour ça.",
    "busy": "Je viens de me poser deux minutes. J'allais justement souffler un peu.",
}


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def extract_anchor(video: Path, target: Path) -> None:
    target.unlink(missing_ok=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", "0.45", "-i", str(video), "-frames:v", "1",
        "-vf", f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT}",
        str(target),
    ], check=True, timeout=90)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Could not extract V7 visual anchor")


def generate_video(key: str, prompt_tail: str, duration: int, anchor: Path) -> tuple[Path, str]:
    base = engine.LUCAS_VISIO_TEST1
    output = engine.WORK_DIR / f"visio-lucas-v2-{key}-candidate.mp4"
    profile = replace(
        base,
        key=f"lucas-visio-v2-{key}",
        prompt=(
            "Animate this V7-derived Lucas frame as a genuine continuous smartphone video call. "
            + IDENTITY + ALIVE + prompt_tail +
            " Do not add phone UI, subtitles or captions. This is the raw remote camera feed only."
        ),
        negative=NEGATIVE,
        width=WIDTH,
        height=HEIGHT,
        aspect_ratio="9:16 (Portrait)",
        duration=duration,
        output_name=output.name,
    )
    output.unlink(missing_ok=True)
    try:
        provider = engine._run_ltx(profile, anchor, output)
    except Exception:
        output.unlink(missing_ok=True)
        provider = engine._run_wan(profile, anchor, output)
    if not engine.worker.looks_like_video(output):
        raise RuntimeError(f"Invalid generated video for {key}")
    return output, provider


def extract_audio(video: Path, target: Path) -> None:
    target.unlink(missing_ok=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(video), "-vn", "-ac", "1", "-ar", "24000", "-af", "highpass=f=55", str(target),
    ], check=True, timeout=90)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Generated speaking clip has no usable native speech")


def resolve_audio(result) -> Path:
    items = list(reversed(result)) if isinstance(result, (list, tuple)) else [result]
    for item in items:
        if isinstance(item, str):
            p = Path(item)
            if p.exists() and p.stat().st_size > 4096:
                return p
        if isinstance(item, dict):
            raw = item.get("path") or item.get("name")
            if raw:
                p = Path(str(raw))
                if p.exists() and p.stat().st_size > 4096:
                    return p
    raise RuntimeError("Seed-VC returned no usable audio")


def convert_to_v10a(client: Client, source: Path, reference: Path, target: Path) -> None:
    result = client.predict(
        source_audio_path=handle_file(source),
        target_audio_path=handle_file(reference),
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
    converted = resolve_audio(result)
    shutil.copyfile(converted, target)
    if target.stat().st_size < 4096:
        raise RuntimeError("V10-A timbre conversion failed")


def mux(video: Path, audio: Path, output: Path) -> None:
    output.unlink(missing_ok=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(video), "-i", str(audio),
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(output),
    ], check=True, timeout=90)
    if not engine.worker.looks_like_video(output):
        raise RuntimeError("Final speaking candidate invalid")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate candidate-only MonIA Visio 2.0 presence states")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    v7 = engine.WORK_DIR / "visio-v2-v7-source.mp4"
    anchor = engine.WORK_DIR / "visio-v2-v7-anchor.png"
    v10a = engine.WORK_DIR / "visio-v2-v10a-reference.wav"
    download(V7_URL, v7)
    extract_anchor(v7, anchor)
    download(V10A_URL, v10a)

    outputs: list[Path] = []
    for key, (duration, prompt) in SILENT_STATES.items():
        path, provider = generate_video(key, prompt, duration, anchor)
        outputs.append(path)
        print(f"MONIA_VISIO_V2 state={key} provider={provider} output={path}")

    seed = Client(SEED_VC_SPACE, token=(os.environ.get("HF_TOKEN", "").strip() or None), verbose=False, download_files=True)
    for key, line in SPEAKING_STATES.items():
        native_video, provider = generate_video(
            f"speaking-{key}-native",
            (
                f"STATE: SPEAKING. Lucas says exactly in natural casual native French: '{line}' "
                "Generate the speech natively together with the face so jaw, lips, cheeks, eyebrows and breath timing are coherent. "
                "Use relaxed connected contemporary French, restrained melody and imperfect human micro-pauses. After the sentence, settle naturally back toward attentive listening."
            ),
            6,
            anchor,
        )
        native_audio = engine.WORK_DIR / f"visio-lucas-v2-speaking-{key}-native.wav"
        converted = engine.WORK_DIR / f"visio-lucas-v2-speaking-{key}-v10a.wav"
        final = engine.WORK_DIR / f"visio-lucas-v2-speaking-{key}-candidate.mp4"
        extract_audio(native_video, native_audio)
        convert_to_v10a(seed, native_audio, v10a, converted)
        mux(native_video, converted, final)
        outputs.append(final)
        print(f"MONIA_VISIO_V2 state=speaking-{key} provider={provider}+SeedVC-V10A output={final}")

    if args.publish_candidate:
        for path in outputs:
            print(f"MONIA_VISIO_V2_CANDIDATE state={path.stem} url={engine.publish_candidate(path)}")


if __name__ == "__main__":
    main()
