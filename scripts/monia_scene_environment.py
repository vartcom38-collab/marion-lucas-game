from __future__ import annotations

from copy import deepcopy
from typing import Any


def plan_environment(scene: dict[str, Any]) -> dict[str, Any]:
    planned = deepcopy(scene)
    continuity = planned.get("continuityState") or {}
    base_lighting = str(continuity.get("lighting") or "physically coherent natural lighting")
    time_of_day = str(continuity.get("timeOfDay") or "natural time of day")
    location = str(continuity.get("location") or "lived-in environment")
    previous = None

    for index, shot in enumerate(planned.get("shots") or []):
        override = shot.get("environmentOverride") or {}
        state = {
            "location": str(override.get("location") or location),
            "timeOfDay": str(override.get("timeOfDay") or time_of_day),
            "lighting": str(override.get("lighting") or base_lighting),
            "lightDirection": str(override.get("lightDirection") or "preserve established key-light direction across cuts"),
            "exposure": str(override.get("exposure") or "natural skin exposure with stable highlight/shadow balance"),
            "colorContinuity": str(override.get("colorContinuity") or "preserve white balance and environmental color relationships"),
            "roomTone": str(override.get("roomTone") or f"continuous believable ambience for {location}, never digital silence"),
        }
        if previous:
            state["previousShot"] = previous
        shot["environmentContinuity"] = state
        shot["prompt"] = (
            str(shot.get("prompt") or "")
            + " ENVIRONMENT CONTINUITY: "
            + f"location={state['location']}; time={state['timeOfDay']}; lighting={state['lighting']}; "
            + f"lightDirection={state['lightDirection']}; exposure={state['exposure']}; color={state['colorContinuity']}. "
            + "Do not relight the scene between cuts unless the story explicitly changes location or time."
        )
        previous = {k: v for k, v in state.items() if k != "previousShot"}

    return {
        "status": "planned",
        "scene": planned,
        "audioEnvironment": {
            "roomTonePolicy": "continuous-under-dialogue-and-cuts",
            "silencePolicy": "use natural low-level ambience rather than absolute digital silence",
            "perspectivePolicy": "ambience and voice distance must match camera and blocking",
        },
        "policy": {
            "stableLightingAcrossCuts": True,
            "stableWhiteBalance": True,
            "stableRoomTone": True,
            "explicitOverridesOnly": True,
        },
    }
