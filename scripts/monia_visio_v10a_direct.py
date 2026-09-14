from __future__ import annotations

import argparse
import subprocess
from dataclasses import replace
from pathlib import Path

import requests
from PIL import Image

import scripts.monia_video_engine as engine

VOICE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
REFERENCE_IMAGE = Path("resources/monia/canon/lucas/visio-layout-reference.jpg")
OUTPUT_NAME = "visio-lucas-v10a-direct-speaking-candidate.mp4"
GENERATED_NAME = "visio-lucas-v10a-direct-speaking-generated.mp4"

LINE = "Salut... ça va, toi ? Qu'est-ce que tu racontes ?"

# Return to the successful native-speaking method, but with the validated
# upper-body visio layout as composition authority. Lucas speaks natively in the
# video generation itself; only the audio track is then replaced by V10-A.
# No Wav2Lip, MuseTalk, face patch, mouth patch, or playback-rate warping.


def profile() -> engine.CharacterProfile:
    base = engine.LUCAS_VISIO_TEST1
    prompt = (
        "Animate the supplied reference as a REAL smartphone front-camera video call with Lucas. "
        "The supplied frame is the composition authority: preserve the same upper-torso framing, visible shoulders and forearm, "
        "phone held naturally at arm's length, intimate front-camera distance and warm lived-in room depth. "
        "Do NOT turn this into a head-only portrait, beauty close-up or face-focused crop. Keep a meaningful part of his upper body visible throughout. "
        "Lucas must remain exactly the validated Lucas: same facial geometry, dark wavy hair, short stubble, olive skin, no tattoos, no facial scar. "
        "His eyes are canonical: cool green-hazel / gray-green olive with a subtle amber-brown center and darker limbal rim; never uniformly brown or clearly blue. "
        "Keep the relaxed dark shirt, tiny handheld micro-shake, minute framing drift, natural breathing, irregular blinks, subtle autofocus/exposure breathing, "
        "and small gaze shifts between Marion on screen and the lens. The phone-call feeling must be casual, private and lived-in, not cinematic or posed. "
        "Lucas is speaking naturally for almost the whole clip. His mouth, jaw, cheeks, eyes, eyebrows and tiny head movements must behave as one coherent live-action performance. "
        + f"The intended French utterance is: {LINE!r}. Shape the speaking rhythm around this exact short casual sentence: a tiny hesitation after 'Salut', then linked fluent everyday French, relaxed jaw motion, soft consonants and natural reductions. "
        "The visible speaking performance should begin immediately and finish naturally near the end of the clip. Keep the expression intimate, relaxed and attentive, "
        "with soft magnetic eye contact and restrained micro-reactions. No theatrical acting, no presenter delivery, no exaggerated phoneme acting. "
        "Do not add phone UI, subtitles, another person, black borders or a smaller inset video. Preserve full vertical 9:16 composition."
    )
    negative = (
        "head-only portrait, extreme close-up, face-focused crop, beauty close-up, studio portrait, silent pose, frozen mouth, tiny lip-only motion, pasted lips, mouth patch, face patch, "
        "artificial lip replacement, over-articulated phonemes, theatrical diction, presenter performance, tiny centered video, black borders, shrinked frame, identity drift, "
        "changed eyes, uniformly brown eyes, bright blue eyes, tattoos, second person, subtitles, phone UI, cinematic dolly, zoom-in"
    )
    return replace(
        base,
        key="lucas-visio-v10a-direct-speaking-layout",
        prompt=prompt,
        negative=negative,
        width=576,
        height=1024,
        aspect_ratio="9:16 (Portrait)",
        duration=5,
        output_name=GENERATED_NAME,
    )


def prepare_reference(target: Path, width: int, height: int) -> None:
    image = Image.open(REFERENCE_IMAGE).convert("RGB")
    ratio = width / height
    source_ratio = image.width / image.height
    if source_ratio > ratio:
        crop_w = round(image.height * ratio)
        left = max(0, (image.width - crop_w) // 2)
        image = image.crop((left, 0, left + crop_w, image.height))
    elif source_ratio < ratio:
        crop_h = round(image.width / ratio)
        top = max(0, (image.height - crop_h) // 2)
        image = image.crop((0, top, image.width, top + crop_h))
    image.resize((width, height), Image.Resampling.LANCZOS).save(target, "PNG", optimize=True)


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def generate_native() -> tuple[Path, str]:
    p = profile()
    source = engine.WORK_DIR / "lucas-visio-v10a-layout-reference.png"
    target = engine.WORK_DIR / p.output_name
    prepare_reference(source, p.width, p.height)
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


def mux_selected_voice(video: Path, voice: Path, output: Path) -> None:
    output.unlink(missing_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(video),
            "-i", str(voice),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(output),
        ],
        check=True,
    )
    if not engine.worker.looks_like_video(output):
        raise RuntimeError("Final direct-speaking visio is not a valid video")


def build() -> tuple[Path, str]:
    generated, provider = generate_native()
    voice = engine.WORK_DIR / "lucas-v10a-selected.wav"
    output = engine.WORK_DIR / OUTPUT_NAME
    download(VOICE_URL, voice)
    mux_selected_voice(generated, voice, output)
    return output, provider


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate upper-body Lucas speaking natively with MonIA, then attach the selected V10-A voice")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    output, provider = build()
    print(f"MONIA_VISIO_V10A_DIRECT compute={provider} output={output} bytes={output.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_VISIO_V10A_DIRECT_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
