from __future__ import annotations

from copy import deepcopy
from typing import Any


def plan_emotional_continuity(scene: dict[str, Any]) -> dict[str, Any]:
    planned = deepcopy(scene)
    states: dict[str, dict[str, Any]] = {}

    for shot in planned.get("shots") or []:
        actors = [str(a) for a in shot.get("actors") or []]
        consequence = str(shot.get("consequence") or "")
        explicit = shot.get("emotionalState") or {}
        speaker = str(shot.get("speaker") or "").strip()

        for actor in actors:
            state = states.setdefault(actor, {
                "baseline": "natural and context-sensitive",
                "carry": "subtle",
                "lastCause": "scene opening",
            })
            override = explicit.get(actor) if isinstance(explicit, dict) else None
            if isinstance(override, dict):
                state.update(override)
                state["lastCause"] = consequence or state.get("lastCause")
            elif consequence:
                state["lastCause"] = consequence

            if actor == speaker:
                state["expressionRule"] = "emotion is expressed through speech but remains physically continuous before and after the line"
            else:
                state["expressionRule"] = "react as listener with restrained micro-expression; never reset to neutral on the cut"

        visible = {actor: deepcopy(states[actor]) for actor in actors}
        shot["emotionalContinuity"] = visible
        shot["prompt"] = (
            str(shot.get("prompt") or "")
            + " EMOTIONAL CONTINUITY: "
            + "; ".join(
                f"{actor}: baseline={data.get('baseline')}, carry={data.get('carry')}, causedBy={data.get('lastCause')}, rule={data.get('expressionRule')}"
                for actor, data in visible.items()
            )
            + ". Do not reset faces to neutral between cuts. Emotion must evolve from the previous beat, not restart as a new performance."
        )

    return {
        "status": "planned",
        "scene": planned,
        "policy": {
            "noEmotionalResetAtCuts": True,
            "reactionsFollowStoryCause": True,
            "listenersRemainAlive": True,
            "microExpressionPreferredOverExaggeration": True,
        },
    }
