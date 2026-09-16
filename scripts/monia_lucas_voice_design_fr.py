from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

SOURCE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v12-soft-natural-fr-candidate.wav"
V10A_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
SEED_VC_SPACE = "Plachta/Seed-VC"
OUTPUT_NAME = "lucas-voice-v13-v10a-anchored-fr-candidate.wav"

# V13 keeps the approved V12 French flow and re-anchors only the synthetic vocal
# identity toward the project's validated synthetic V10-A Lucas voice. No real-person
# voice cloning, no speed change, no pitch forcing, no word/syllable retiming.


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded audio too small: {url}")


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
    raise RuntimeError(f"Seed-VC returned no usable audio: {type(result).__name__}")


def convert(source: Path, reference: Path, target: Path) -> None:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SEED_VC_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(
        source_audio_path=handle_file(source),
        target_audio_path=handle_file(reference),
        diffusion_steps=30,
        length_adjust=1.0,
        intelligebility_cfg_rate=0.0,
        similarity_cfg_rate=0.64,
        top_p=0.92,
        temperature=0.68,
        repetition_penalty=1.0,
        convert_style=False,
        anonymization_only=False,
        api_name="/predict",
    )
    converted = resolve_audio(result)
    warm = target.with_name(target.stem + "-raw.wav")
    shutil.copyfile(converted, warm)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(warm), "-ac", "1", "-ar", "24000",
        "-af",
        "highpass=f=55,equalizer=f=180:t=q:w=1:g=1.0,equalizer=f=360:t=q:w=1:g=0.5,equalizer=f=3200:t=q:w=1:g=-0.8,equalizer=f=5000:t=q:w=1:g=-0.5,acompressor=threshold=-20dB:ratio=1.2:attack=15:release=120,loudnorm=I=-18:TP=-2:LRA=9",
        str(target),
    ], check=True, timeout=90)
    warm.unlink(missing_ok=True)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Lucas V13 candidate is too small")


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-anchor V12 French flow on validated synthetic V10-A Lucas timbre")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    source = engine.WORK_DIR / "lucas-v12-source.wav"
    reference = engine.WORK_DIR / "lucas-v10a-reference.wav"
    target = engine.WORK_DIR / OUTPUT_NAME
    download(SOURCE_URL, source)
    download(V10A_URL, reference)
    target.unlink(missing_ok=True)
    convert(source, reference, target)

    print(f"MONIA_LUCAS_V13_V10A_ANCHORED_FR output={target} bytes={target.stat().st_size}")
    print("MONIA_LUCAS_V13_V10A_ANCHORED_FR timing_source=V12 timbre_anchor=V10-A length_adjust=1.0 live_manifest_changed=false")
    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_V13_V10A_ANCHORED_FR_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
