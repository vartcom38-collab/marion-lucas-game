from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
SEED_VC_SPACE = "Plachta/Seed-VC"
V16_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-v16-b-smoother-flow-fr-candidate.wav"
)
TEXT = "Ah ouais, ça me fait plaisir que tu m'appelles juste pour ça."

# V19 deliberately separates French performance from Lucas timbre.
# Step 1: create one naturally flowing French synthetic donor with no attempt to imitate Lucas.
# Step 2: convert only the broad synthetic timbre toward the approved synthetic V16 Lucas reference.
# This avoids asking one model to invent French prosody and preserve Lucas identity simultaneously.
DONOR_DESCRIPTION = (
    "Native French young adult male speaking privately on a phone call, relaxed and spontaneous, "
    "warm but ordinary, not theatrical. Say the whole sentence as one connected conversational thought. "
    "Natural French linking, soft attack on 'Ah ouais', no reset after commas, no presenter diction. "
    "Use tiny irregular micro-pauses only when humanly needed, roughly 0.15 to 0.30 seconds, never long dead air. "
    "Keep natural breath flow, imperfect micro-rhythm, relaxed consonants, gentle low ending. "
    "Do not sound polished, commercial, robotic, syllabic, metronomic, overly sensual or artificially deep."
)

VARIANTS = {
    "a": 0.58,
    "b": 0.68,
}


def resolve_audio(result) -> Path:
    items = result if isinstance(result, (list, tuple)) else [result]
    for item in reversed(items):
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
    raise RuntimeError(f"No usable audio in result: {type(result).__name__}")


def download(url: str, target: Path) -> None:
    import requests
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def finish_like_v16(source: Path, target: Path) -> None:
    target.unlink(missing_ok=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-ac", "1", "-ar", "24000",
        "-af",
        "highpass=f=55,equalizer=f=190:t=q:w=1:g=0.8,equalizer=f=350:t=q:w=1:g=0.4,equalizer=f=3200:t=q:w=1:g=-0.7,equalizer=f=5200:t=q:w=1:g=-0.4,acompressor=threshold=-21dB:ratio=1.15:attack=18:release=140,loudnorm=I=-18:TP=-2:LRA=9",
        str(target),
    ], check=True, timeout=90)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Finished V19 candidate is too small")


def generate_donor(client: Client, target: Path) -> None:
    result = client.predict(TEXT, "French", DONOR_DESCRIPTION, api_name="/generate_voice_design")
    source = resolve_audio(result)
    shutil.copyfile(source, target)


def convert(seed: Client, donor: Path, v16: Path, similarity: float, target: Path) -> None:
    result = seed.predict(
        source_audio_path=handle_file(donor),
        target_audio_path=handle_file(v16),
        diffusion_steps=30,
        length_adjust=1.0,
        intelligebility_cfg_rate=0.0,
        similarity_cfg_rate=similarity,
        top_p=0.92,
        temperature=0.72,
        repetition_penalty=1.0,
        convert_style=False,
        anonymization_only=False,
        api_name="/predict",
    )
    converted = resolve_audio(result)
    finish_like_v16(converted, target)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Lucas V19 prosody-first French candidates")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    qwen = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    seed = Client(SEED_VC_SPACE, token=token, verbose=False, download_files=True)

    donor = engine.WORK_DIR / "lucas-v19-natural-french-donor.wav"
    v16 = engine.WORK_DIR / "lucas-v16-approved-synthetic-reference.wav"
    generate_donor(qwen, donor)
    download(V16_URL, v16)

    print(f"MONIA_LUCAS_V19 donor={donor} mode=prosody_first text={TEXT!r}")
    for key, similarity in VARIANTS.items():
        target = engine.WORK_DIR / f"lucas-voice-v19-{key}-prosody-first-fr-candidate.wav"
        convert(seed, donor, v16, similarity, target)
        print(f"MONIA_LUCAS_V19 variant={key} similarity={similarity} output={target} bytes={target.stat().st_size}")
        if args.publish_candidate:
            url = engine.publish_candidate(target)
            print(f"MONIA_LUCAS_V19_CANDIDATE variant={key} url={url}")


if __name__ == "__main__":
    main()
