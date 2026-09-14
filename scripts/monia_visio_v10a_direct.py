from __future__ import annotations

import argparse
import subprocess
from dataclasses import replace
from pathlib import Path

import requests

import scripts.monia_video_engine as engine

VOICE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
OUTPUT_NAME = "visio-lucas-v10a-direct-speaking-candidate.mp4"
GENERATED_NAME = "visio-lucas-v10a-direct-speaking-generated.mp4"

LINE = "Salut... ça va, toi ? Qu'est-ce que tu racontes ?"

# This deliberately returns to the method that produced the first convincing
# Lucas visio tests: generate Lucas speaking natively in the video model, with
# face, jaw, lips, eyes, gaze and micro-expressions synthesized together in one
# pass. We then replace only the generated audio track with the selected V10-A
# voice. No Wav2Lip/MuseTalk mouth replacement and no playback-rate warping.


def profile() -> engine.CharacterProfile:
    base = engine.LUCAS_VISIO_TEST1
    prompt = (
        base.prompt
        + " This is a real private smartphone video call, vertical 9:16, upper chest to hair visible, warm lived-in room, natural handheld phone feel. "
        + "Lucas is speaking naturally for almost the whole clip. His mouth, jaw, cheeks, eyes, eyebrows and tiny head movements must all behave as one coherent live-action performance, exactly like a real person talking on a phone camera. "
        + "Preserve his exact validated identity and especially his cool green-hazel / gray-green olive eyes with the subtle amber center. "
        + f"The intended French utterance is: {LINE!r}. Shape the speaking rhythm around this short casual sentence: a tiny hesitation after 'Salut', then linked fluent everyday French, relaxed jaw motion, soft consonants, no exaggerated phoneme acting. "
        + "The visible speaking performance should begin immediately and finish naturally near the end of the clip. Keep the expression intimate, relaxed and attentive, with the magnetic soft eye contact from the earlier successful Lucas speaking tests. "
        + "Do not create an extreme close-up, do not shrink the frame, do not add interface graphics, subtitles or another person."
    )
    negative = (
        base.negative
        + ", silent pose, frozen mouth, tiny lip-only motion, pasted lips, mouth patch, face patch, artificial lip replacement, "
        + "over-articulated phonemes, theatrical diction, presenter performance, extreme close-up, tiny centered video, black borders, "
        + "identity drift, changed eyes, uniformly brown eyes, bright blue eyes, tattoos, second person, subtitles, phone UI"
    )
    return replace(
        base,
        key="lucas-visio-v10a-direct-speaking",
        prompt=prompt,
        negative=negative,
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
    source = engine.WORK_DIR / "lucas-visio-v10a-direct-canon.png"
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
    parser = argparse.ArgumentParser(description="Generate Lucas speaking natively with MonIA, then attach the selected V10-A voice")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    output, provider = build()
    print(f"MONIA_VISIO_V10A_DIRECT compute={provider} output={output} bytes={output.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_VISIO_V10A_DIRECT_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
