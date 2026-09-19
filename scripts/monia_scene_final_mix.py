from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


def _ffmpeg(args: list[str]) -> None:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg required")
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError((p.stderr or p.stdout or "ffmpeg failed").strip())


def _has_audio(path: Path) -> bool:
    if not shutil.which("ffprobe"):
        return False
    p = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    return p.returncode == 0 and "audio" in (p.stdout or "").strip().lower()


def assemble_final(
    lipsync_result: dict[str, Any],
    av_plan: dict[str, Any],
    output_dir: Path,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    usable = [s for s in lipsync_result.get("shots") or [] if s.get("path")]
    if not usable:
        raise RuntimeError("No usable scene shots for final mix")

    concat = output_dir / "video-concat.txt"
    concat.write_text("\n".join(f"file '{Path(str(s['path'])).resolve().as_posix()}'" for s in usable) + "\n", encoding="utf-8")
    video = output_dir / "picture.mp4"
    _ffmpeg(["-f", "concat", "-safe", "0", "-i", str(concat), "-c:v", "libx264", "-c:a", "aac", "-b:a", "128k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(video)])

    utterances = [u for u in av_plan.get("utterances") or [] if u.get("audioPath")]
    final = output_dir / "scene-final-candidate.mp4"
    if not utterances:
        shutil.copy2(video, final)
        status = "picture-only"
    else:
        args = ["-i", str(video)]
        filters = []
        mix_inputs = []
        has_room_tone = _has_audio(video)
        # Preserve low-level production ambience only when an audio stream really exists.
        if has_room_tone:
            filters.append("[0:a]volume=0.18[room]")
            mix_inputs.append("[room]")
        for idx, u in enumerate(utterances, start=1):
            args += ["-i", str(u["audioPath"])]
            delay = max(0, int(u.get("startMs") or 0))
            filters.append(f"[{idx}:a]adelay={delay}:all=1[a{idx}]")
            mix_inputs.append(f"[a{idx}]")
        filters.append("".join(mix_inputs) + f"amix=inputs={len(mix_inputs)}:duration=longest:dropout_transition=0:normalize=0[aout]")
        args += [
            "-filter_complex", ";".join(filters),
            "-map", "0:v:0", "-map", "[aout]",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart", "-shortest", str(final),
        ]
        _ffmpeg(args)
        status = "av-candidate"

    result = {
        "status": status,
        "output": str(final),
        "bytes": final.stat().st_size,
        "dialogueTracks": len(utterances),
        "roomTone": "production ambience preserved at low level when source shots contain audio; otherwise dialogue-only; no synthetic ambience invented",
        "approvalRequired": True,
        "autoPublish": False,
    }
    (output_dir / "final-mix-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result
