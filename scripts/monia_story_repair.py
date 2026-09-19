from __future__ import annotations

from copy import deepcopy
from typing import Any

from scripts.monia_story_logic import validate_story_logic


def repair_story_logic(job: dict[str, Any]) -> dict[str, Any]:
    repaired = deepcopy(job)
    changes: list[dict[str, Any]] = []
    shots = repaired.get("shots") or []
    present: list[str] = []

    for index, shot in enumerate(shots):
        actors = [str(a) for a in shot.get("actors") or []]
        entrances = [str(a) for a in shot.get("entrances") or []]
        exits = [str(a) for a in shot.get("exits") or []]
        speaker = str(shot.get("speaker") or "").strip()
        focus = str(shot.get("focusActor") or "").strip()

        if index == 0:
            present = [a for a in actors if a not in entrances]
        present = [a for a in present if a not in exits]
        for actor in entrances:
            if actor not in present:
                present.append(actor)

        # A named speaker must physically exist in the shot.
        if speaker and speaker not in actors:
            actors.append(speaker)
            if speaker not in present:
                entrances.append(speaker)
                present.append(speaker)
            changes.append({"shotId": shot.get("id"), "fix": "speaker-presence", "actor": speaker})

        # A camera focus on an absent actor is normally a planning mistake.
        if focus and focus not in actors:
            if focus in present:
                actors.append(focus)
                changes.append({"shotId": shot.get("id"), "fix": "focus-added-to-visible-actors", "actor": focus})
            elif actors:
                old = focus
                shot["focusActor"] = actors[0]
                changes.append({"shotId": shot.get("id"), "fix": "focus-retargeted", "from": old, "to": actors[0]})

        shot["actors"] = actors
        shot["entrances"] = entrances
        shot["exits"] = exits
        present = list(actors)

    validation = validate_story_logic(repaired)
    return {
        "status": "repaired" if changes and validation.get("status") != "invalid" else ("unchanged-valid" if not changes and validation.get("status") != "invalid" else "unresolved"),
        "changes": changes,
        "validation": validation,
        "scene": repaired,
        "policy": "Only deterministic presence/focus mistakes are auto-repaired. Ambiguous story contradictions remain blocked.",
    }
