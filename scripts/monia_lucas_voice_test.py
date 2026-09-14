from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

REFERENCE_VIDEO_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "visio-lucas-speaking-candidate.mp4?run=34821590907"
)
VOICE_SPACE = "applore/xtts-voice-cloning-demo"
VOICE_API = "/predict"
TEXT = "Hey... ça va, toi ? T'as l'air un peu crevée."
OUTPUT_NAME = "lucas-voice-v1-candidate.wav"


def download_reference(video_path: Path) -> None:
    response = requests.get(
        REFERENCE_VIDEO_URL,
        timeout=60,
        headers={"Cache-Control": "no-cache", "Accept": "video/*,*/*"},
    )
    response.raise_for_status()
    if len(response.content) < 4096:
        raise RuntimeError("Lucas V3 reference video is too small")
    video_path.write_bytes(response.content)


def extract_reference_audio(video_path: Path, wav_path: Path) -> None:
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(video_path),
        "-vn", "-ac", "1", "-ar", "24000",
        "-af", "highpass=f=70,lowpass=f=11000,loudnorm=I=-18:TP=-2:LRA=7",
        str(wav_path),
    ]
    subprocess.run(command, check=True, timeout=60)
    if not wav_path.exists() or wav_path.stat().st_size < 4096:
        raise RuntimeError("Could not extract a usable Lucas voice reference")


def synthesize(reference_wav: Path, target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(VOICE_SPACE, token=token, verbose=False)
    result = client.predict(TEXT, handle_file(reference_wav), "fr", api_name=VOICE_API)

    source: Path | None = None
    if isinstance(result, str):
        source = Path(result)
    elif isinstance(result, dict):
        candidate = result.get("path") or result.get("name")
        if candidate:
            source = Path(str(candidate))
    elif isinstance(result, (list, tuple)) and result:
        first = result[0]
        if isinstance(first, str):
            source = Path(first)
        elif isinstance(first, dict):
            candidate = first.get("path") or first.get("name")
            if candidate:
                source = Path(str(candidate))

    if not source or not source.exists():
        raise RuntimeError(f"XTTS returned no usable audio file: {type(result).__name__}")
    shutil.copyfile(source, target)
    if target.stat().st_size < 4096:
        raise RuntimeError("Generated Lucas voice candidate is too small")
    return "XTTS-v2 voice-reference clone"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a candidate-only Lucas French voice from the preferred V3 voice reference")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    work = engine.WORK_DIR
    video = work / "lucas-v3-voice-reference.mp4"
    reference = work / "lucas-v3-voice-reference.wav"
    target = work / OUTPUT_NAME

    download_reference(video)
    extract_reference_audio(video, reference)
    target.unlink(missing_ok=True)
    provider = synthesize(reference, target)
    print(f"MONIA_LUCAS_VOICE compute={provider} output={target} bytes={target.stat().st_size}")

    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_VOICE_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
