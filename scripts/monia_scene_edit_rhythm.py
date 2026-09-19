from __future__ import annotations

from copy import deepcopy
from typing import Any


def plan_edit_rhythm(scene: dict[str, Any]) -> dict[str, Any]:
    planned = deepcopy(scene)
    shots = planned.get("shots") or []
    for index, shot in enumerate(shots):
        base = float(shot.get("duration") or 4)
        speaker = str(shot.get("speaker") or "").strip()
        shot_id = str(shot.get("id") or "").lower()
        consequence = str(shot.get("consequence") or "").lower()

        hold_ms = 220
        reason = "natural observation"
        if speaker:
            hold_ms = 320
            reason = "hold through the end of speech and listener reaction"
        if "reaction" in shot_id or any(x in consequence for x in ["realize", "discover", "silence", "hesitat", "surprise"]):
            hold_ms = max(hold_ms, 520)
            reason = "protect meaningful reaction and post-beat silence"
        if any(x in shot_id for x in ["action", "arrival", "entrance"]):
            base = max(2.5, base - 0.4)
            reason = "action can cut once spatial information is understood"

        duration = round(min(8.0, max(2.0, base + hold_ms / 1000.0)), 2)
        shot["duration"] = duration
        shot["editRhythm"] = {
            "targetDurationSec": duration,
            "postBeatHoldMs": hold_ms,
            "cutReason": reason,
            "rule": "cut on comprehension, reaction or changed dramatic information; never on a fixed metronomic cadence",
        }
        shot["prompt"] = (
            str(shot.get("prompt") or "")
            + f" EDIT RHYTHM: allow approximately {hold_ms}ms of natural post-beat reaction before the cut when performance supports it. "
            + "Do not rush the final expression and do not manufacture a fixed rhythmic gesture at the end of the shot."
        )
    return {
        "status": "planned",
        "scene": planned,
        "policy": {
            "noFixedCadence": True,
            "reactionCanHold": True,
            "silenceCanCarryMeaning": True,
            "cutOnChangedInformation": True,
        },
    }
