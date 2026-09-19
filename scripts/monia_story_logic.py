from __future__ import annotations

from typing import Any


def validate_story_logic(job: dict[str, Any]) -> dict[str, Any]:
    errors = []
    warnings = []
    present: set[str] = set()
    seen: set[str] = set()
    shots = job.get("shots") or []

    for index, shot in enumerate(shots):
        shot_id = str(shot.get("id") or index + 1)
        actors = {str(a) for a in shot.get("actors") or []}
        entrances = {str(a) for a in shot.get("entrances") or []}
        exits = {str(a) for a in shot.get("exits") or []}
        speaker = str(shot.get("speaker") or "").strip()
        focus = str(shot.get("focusActor") or "").strip()

        if index == 0:
            present |= actors - entrances
        present -= exits
        present |= entrances

        impossible = actors - present
        if impossible:
            errors.append({"shotId": shot_id, "type": "actor-present-without-entry", "actors": sorted(impossible)})
        if speaker and speaker not in actors:
            errors.append({"shotId": shot_id, "type": "speaker-not-visible", "actor": speaker})
        if focus and focus not in actors:
            warnings.append({"shotId": shot_id, "type": "focus-actor-not-visible", "actor": focus})
        reentries = entrances & present & seen
        if reentries:
            warnings.append({"shotId": shot_id, "type": "possible-reentry", "actors": sorted(reentries)})
        seen |= actors
        present = set(actors)

    return {
        "status": "invalid" if errors else ("warning" if warnings else "valid"),
        "errors": errors,
        "warnings": warnings,
        "shotCount": len(shots),
    }
