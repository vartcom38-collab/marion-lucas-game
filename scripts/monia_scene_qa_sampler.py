from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


def extract_review_frames(video_result: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg required for visual QA sampling")
    output_dir.mkdir(parents=True, exist_ok=True)
    samples = []
    for index, shot in enumerate(video_result.get("shots") or [], start=1):
        raw = shot.get("path")
        if not raw:
            continue
        source = Path(str(raw))
        shot_dir = output_dir / f"{index:02d}-{shot.get('id') or 'shot'}"
        shot_dir.mkdir(parents=True, exist_ok=True)
        pattern = shot_dir / "frame-%02d.jpg"
        # Five evenly distributed samples catch identity drift/morphing much better than a single thumbnail.
        proc = subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source),
            "-vf", "fps=5/4,scale=640:-2",
            "-frames:v", "5",
            "-q:v", "2",
            str(pattern),
        ], capture_output=True, text=True)
        frames = sorted(str(p) for p in shot_dir.glob("frame-*.jpg"))
        samples.append({
            "shotId": shot.get("id"),
            "source": str(source),
            "status": "sampled" if proc.returncode == 0 and frames else "sampling-failed",
            "frames": frames,
            "error": None if proc.returncode == 0 else (proc.stderr or proc.stdout).strip(),
        })
    result = {"status": "ready" if samples and all(s["status"] == "sampled" for s in samples) else "partial", "samples": samples}
    (output_dir / "samples.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result
