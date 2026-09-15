from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import scripts.monia_video_engine as engine

OUTPUT_NAME = "lucas-visio-dialogue-human-performance-warm-candidate.wav"


def run_gate(source: Path) -> None:
    subprocess.run(
        ["python", "-m", "scripts.monia_lucas_performance_gate", str(source)],
        check=True,
        timeout=90,
    )


def normalize_without_retiming(source: Path, target: Path) -> None:
    # Preserve the original performance timing and prosody exactly.
    # Only remove sub-bass rumble and normalize loudness for fair A/B listening.
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source),
            "-vn", "-ac", "1", "-ar", "24000",
            "-af", "highpass=f=55,loudnorm=I=-18:TP=-2:LRA=9",
            str(target),
        ],
        check=True,
        timeout=90,
    )
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Human performance candidate normalization failed")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prepare one human-performance-first Lucas visio candidate without TTS or timing changes"
    )
    parser.add_argument("source", type=Path)
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    run_gate(args.source)

    target = engine.WORK_DIR / OUTPUT_NAME
    target.unlink(missing_ok=True)
    normalize_without_retiming(args.source, target)

    # Re-run the gate after normalization to ensure the audio stayed structurally intact.
    run_gate(target)

    print(f"MONIA_LUCAS_HUMAN_PERFORMANCE output={target} bytes={target.stat().st_size}")
    print("MONIA_LUCAS_HUMAN_PERFORMANCE timing_changed=false tts_used=false")

    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_HUMAN_PERFORMANCE_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
