from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
SEED_VC_SPACE = "Plachta/Seed-VC"
LANGUAGE = "French"
CALIBRATION_TEXT = "Bonsoir. Je suis là."
OUTPUT_NAME = "lucas-human-prosody-fr-candidate.wav"

# The user recording is prosody-only. The Lucas target timbre is synthetic and
# built from broad, non-identifying traits. No real-person voiceprint cloning.
TIMBRE_DESCRIPTION = (
    "A distinct synthetic native French young adult male voice. Naturally low, warm and calm, "
    "with soft intimate low-mid resonance, relaxed consonants and very little brightness. "
    "Keep the timbre compact and human, slightly textured but not dry, never exaggeratedly deep. "
    "This calibration utterance is for timbre only: do not use its pacing or melody as the final performance. "
    "No presenter tone, no trailer voice, no whisper, no growl, no robotic cadence, no sing-song intonation."
)


def run_gate(source: Path) -> None:
    subprocess.run(
        ["python", "-m", "scripts.monia_lucas_performance_gate", str(source)],
        check=True,
        timeout=90,
    )


def normalize_source(source: Path, target: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source), "-vn", "-ac", "1", "-ar", "24000",
            "-af", "highpass=f=55,loudnorm=I=-18:TP=-2:LRA=9",
            str(target),
        ],
        check=True,
        timeout=90,
    )
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Could not normalize human French performance")


def _resolve_audio(result) -> Path:
    items = result if isinstance(result, (list, tuple)) else [result]
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
    raise RuntimeError(f"Voice service returned no usable audio: {type(result).__name__}")


def make_synthetic_timbre(target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(
        CALIBRATION_TEXT,
        LANGUAGE,
        TIMBRE_DESCRIPTION,
        api_name="/generate_voice_design",
    )
    source = _resolve_audio(result)
    shutil.copyfile(source, target)
    if target.stat().st_size < 4096:
        raise RuntimeError("Synthetic Lucas timbre calibration is too small")
    return "Qwen synthetic timbre calibration only"


def convert_preserving_human_prosody(source: Path, synthetic_timbre: Path, target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SEED_VC_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(
        source_audio_path=handle_file(source),
        target_audio_path=handle_file(synthetic_timbre),
        diffusion_steps=30,
        length_adjust=1.0,
        intelligebility_cfg_rate=0.0,
        similarity_cfg_rate=0.58,
        top_p=0.92,
        temperature=0.72,
        repetition_penalty=1.0,
        convert_style=False,
        anonymization_only=False,
        api_name="/predict",
    )
    converted = _resolve_audio(result)
    shutil.copyfile(converted, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Human-prosody French Lucas candidate is too small")
    return "Seed-VC with human performance as timing/prosody source and synthetic timbre target"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create one French Lucas candidate that preserves a natural human performance while using a distinct synthetic Lucas timbre"
    )
    parser.add_argument("source", type=Path, help="Natural French performance of the exact target line")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    if not args.source.exists():
        raise SystemExit(f"Missing performance source: {args.source}")

    run_gate(args.source)

    work = engine.WORK_DIR
    normalized = work / "lucas-human-prosody-fr-source.wav"
    timbre = work / "lucas-synthetic-timbre-calibration.wav"
    target = work / OUTPUT_NAME

    normalize_source(args.source, normalized)
    run_gate(normalized)
    timbre_provider = make_synthetic_timbre(timbre)
    target.unlink(missing_ok=True)
    conversion_provider = convert_preserving_human_prosody(normalized, timbre, target)
    run_gate(target)

    payload = {
        "status": "candidate-only",
        "timing_source": "human French performance",
        "user_voice_identity_used": False,
        "user_timbre_used": False,
        "synthetic_timbre": True,
        "timing_changed": False,
        "length_adjust": 1.0,
        "timbre_provider": timbre_provider,
        "conversion_provider": conversion_provider,
        "output": str(target),
    }
    print("MONIA_LUCAS_HUMAN_PROSODY_FR " + json.dumps(payload, ensure_ascii=False))

    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_HUMAN_PROSODY_FR_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
