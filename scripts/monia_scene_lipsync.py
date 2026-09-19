from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts.monia_lipsync import run as run_lipsync


def apply_targeted_lipsync(
    video_result: dict[str, Any],
    av_plan: dict[str, Any],
    voice_dir: Path,
    output_dir: Path,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    shot_results = {str(s.get("id")): s for s in video_result.get("shots") or []}
    utterances = av_plan.get("utterances") or []
    results = []

    for shot in av_plan.get("shots") or []:
        shot_id = str(shot.get("id"))
        source_info = shot_results.get(shot_id) or {}
        source_raw = source_info.get("path")
        if not source_raw:
            results.append({"id": shot_id, "status": "missing-video"})
            continue
        source = Path(str(source_raw))
        if not shot.get("lipSyncRequired"):
            results.append({"id": shot_id, "status": "original-kept", "path": str(source), "reason": "listener-only"})
            continue

        overlapping = [
            u for u in utterances
            if int(u.get("startMs") or 0) < int(shot.get("endMs") or 0)
            and int(u.get("endMs") or 0) > int(shot.get("startMs") or 0)
            and u.get("audioPath")
        ]
        # Current MuseTalk backend accepts one audio track. Multi-speaker overlap remains a clean-video fallback
        # until the final per-character compositing stage is available.
        if len(overlapping) != 1:
            results.append({
                "id": shot_id, "status": "original-kept", "path": str(source),
                "reason": "no-single-rendered-speaker-track",
            })
            continue

        utterance = overlapping[0]
        audio = Path(str(utterance["audioPath"]))
        target = output_dir / f"{shot_id}-lipsync.mp4"
        try:
            meta = run_lipsync(source, audio, target)
            results.append({
                "id": shot_id, "status": "lipsync-ready", "path": str(target),
                "speaker": utterance.get("speaker"), "meta": meta,
            })
        except Exception as exc:
            results.append({
                "id": shot_id, "status": "original-kept", "path": str(source),
                "speaker": utterance.get("speaker"), "reason": "lipsync-nonfatal-fallback",
                "error": str(exc),
            })

    result = {
        "status": "ready" if results and all(r.get("status") not in {"missing-video"} for r in results) else "partial",
        "shots": results,
        "failurePolicy": "non-fatal; preserve original generated video",
    }
    (output_dir / "lipsync-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result
