from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def detect_silence(path: Path) -> tuple[float, float]:
    result = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
            "-af", "silencedetect=noise=-42dB:d=0.18", "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
    )
    starts = result.stderr.count("silence_start:")
    ends = result.stderr.count("silence_end:")
    return float(starts), float(ends)


def main() -> None:
    parser = argparse.ArgumentParser(description="Gate a natural spoken performance before Lucas visio use")
    parser.add_argument("source", type=Path)
    parser.add_argument("--min-duration", type=float, default=1.2)
    parser.add_argument("--max-duration", type=float, default=12.0)
    args = parser.parse_args()

    if not args.source.exists() or args.source.stat().st_size < 4096:
        raise SystemExit("PERFORMANCE_GATE rejected: missing or tiny source")

    duration = probe_duration(args.source)
    if not args.min_duration <= duration <= args.max_duration:
        raise SystemExit(f"PERFORMANCE_GATE rejected: duration={duration:.2f}s")

    silence_starts, silence_ends = detect_silence(args.source)
    # A short conversational line can contain breathing and one or two pauses,
    # but many detected gaps usually means stitched or word-by-word audio.
    if silence_starts > 5:
        raise SystemExit(f"PERFORMANCE_GATE rejected: too many silence regions ({int(silence_starts)})")

    payload = {
        "accepted": True,
        "duration_seconds": round(duration, 3),
        "silence_regions": int(min(silence_starts, silence_ends)),
        "note": "Technical gate only. Human listening approval is still mandatory."
    }
    print("PERFORMANCE_GATE " + json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
