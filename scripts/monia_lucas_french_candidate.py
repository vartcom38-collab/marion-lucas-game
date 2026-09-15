from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


TARGET_TEXT = "Ah ouais... ça me fait plaisir que tu m'appelles juste pour ça."


def normalize_human_source(source: Path, target: Path) -> None:
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-vn", "-ac", "1", "-ar", "24000",
        "-af",
        "highpass=f=55,"
        "equalizer=f=170:t=q:w=0.9:g=1.2,"
        "equalizer=f=320:t=q:w=1.0:g=0.8,"
        "equalizer=f=3000:t=q:w=1.0:g=-1.8,"
        "equalizer=f=4800:t=q:w=1.1:g=-1.2,"
        "acompressor=threshold=-20dB:ratio=1.4:attack=24:release=170:makeup=1.0,"
        "loudnorm=I=-18:TP=-2:LRA=9",
        str(target),
    ], check=True, timeout=90)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("French human-performance candidate could not be created")


def run_gate(source: Path) -> str:
    result = subprocess.run([
        "python", "scripts/monia_lucas_performance_gate.py", str(source),
        "--min-duration", "1.2", "--max-duration", "12.0"
    ], check=True, capture_output=True, text=True)
    return result.stdout.strip()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prepare one human-first French Lucas voice candidate without TTS or time warping"
    )
    parser.add_argument("source", type=Path, help="Natural French spoken performance of the exact target line")
    parser.add_argument("--output", type=Path, default=Path(".monia-video/lucas-french-human-first-candidate.wav"))
    args = parser.parse_args()

    if not args.source.exists():
        raise SystemExit(f"Missing French performance source: {args.source}")

    before = run_gate(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    normalize_human_source(args.source, args.output)
    after = run_gate(args.output)

    payload = {
        "status": "candidate-only",
        "target_text": TARGET_TEXT,
        "source_gate": before,
        "candidate_gate": after,
        "output": str(args.output),
        "rules": [
            "no TTS",
            "no playback-rate change",
            "no pitch shift",
            "no word-by-word editing",
            "human approval required"
        ]
    }
    print("MONIA_LUCAS_FRENCH_CANDIDATE " + json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
