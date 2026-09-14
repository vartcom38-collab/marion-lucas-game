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
VOICE_SPACE = "ResembleAI/Chatterbox-Multilingual-TTS"
VOICE_API = "/generate_tts_audio"
TEXT = "Hey... ça va, toi ? T'as l'air un peu crevée."

VARIANTS = (
    ("soft", 0.35, 0.68, 1307, 0.25),
    ("warm", 0.50, 0.72, 2209, 0.25),
    ("suave", 0.70, 0.70, 3911, 0.20),
)


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
    # Keep the original timbre/prosody as intact as possible: only mono/resample and
    # a gentle high-pass. No loudness remapping or compression in the reference.
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(video_path),
        "-vn", "-ac", "1", "-ar", "24000",
        "-af", "highpass=f=55",
        str(wav_path),
    ]
    subprocess.run(command, check=True, timeout=60)
    if not wav_path.exists() or wav_path.stat().st_size < 4096:
        raise RuntimeError("Could not extract a usable Lucas V3 voice reference")


def result_path(result) -> Path:
    if isinstance(result, str):
        return Path(result)
    if isinstance(result, dict):
        candidate = result.get("path") or result.get("name")
        if candidate:
            return Path(str(candidate))
    if isinstance(result, (list, tuple)):
        for item in result:
            if isinstance(item, str) and Path(item).exists():
                return Path(item)
            if isinstance(item, dict):
                candidate = item.get("path") or item.get("name")
                if candidate and Path(str(candidate)).exists():
                    return Path(str(candidate))
    raise RuntimeError(f"Chatterbox returned no usable audio file: {type(result).__name__}")


def generate_variant(client: Client, reference_wav: Path, label: str, exaggeration: float, temperature: float, seed: int, cfg: float) -> Path:
    result = client.predict(
        TEXT,
        "fr",
        handle_file(reference_wav),
        exaggeration,
        temperature,
        seed,
        cfg,
        api_name=VOICE_API,
    )
    source = result_path(result)
    target = engine.WORK_DIR / f"lucas-voice-v2-{label}-candidate.wav"
    target.unlink(missing_ok=True)
    shutil.copyfile(source, target)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Generated Lucas voice variant {label} is too small")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate three Chatterbox candidate-only Lucas French voice variants from V3 reference")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    work = engine.WORK_DIR
    video = work / "lucas-v3-voice-reference.mp4"
    reference = work / "lucas-v3-voice-reference-clean.wav"
    download_reference(video)
    extract_reference_audio(video, reference)

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(VOICE_SPACE, token=token, verbose=False)

    for label, exaggeration, temperature, seed, cfg in VARIANTS:
        path = generate_variant(client, reference, label, exaggeration, temperature, seed, cfg)
        print(
            f"MONIA_LUCAS_VOICE_V2 label={label} exaggeration={exaggeration} temp={temperature} seed={seed} cfg={cfg} output={path} bytes={path.stat().st_size}"
        )
        if args.publish_candidate:
            url = engine.publish_candidate(path)
            print(f"MONIA_LUCAS_VOICE_V2_CANDIDATE label={label} url={url}")


if __name__ == "__main__":
    main()
