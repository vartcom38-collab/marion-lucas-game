from __future__ import annotations

from copy import deepcopy
from typing import Any


def plan_camera(scene: dict[str, Any]) -> dict[str, Any]:
    planned = deepcopy(scene)
    shots = planned.get("shots") or []
    mode = str((planned.get("director") or {}).get("mode") or "cinematic").lower()
    previous_size = None
    axis = str((planned.get("continuityState") or {}).get("cameraAxis") or "establish and preserve a coherent 180-degree axis")

    for index, shot in enumerate(shots):
        actors = [str(a) for a in shot.get("actors") or []]
        speaker = str(shot.get("speaker") or "").strip()
        focus = str(shot.get("focusActor") or (speaker if speaker else (actors[0] if actors else "")))
        explicit = shot.get("cameraPlan") or {}

        if mode == "visio":
            size = "natural arm-length front-camera framing"
            movement = "tiny human handheld drift only"
            camera_side = "viewer is the other participant through the invisible phone"
            cut_reason = "single continuous front-camera presence"
        else:
            size = str(explicit.get("shotSize") or (
                "wide/medium establishing" if index == 0 else
                "close reaction" if "reaction" in str(shot.get("id") or "").lower() else
                "medium close conversational"
            ))
            movement = str(explicit.get("movement") or "subtle motivated camera movement; never decorative")
            camera_side = str(explicit.get("axis") or axis)
            cut_reason = str(explicit.get("cutReason") or (
                "establish geography" if index == 0 else
                "speaker/reaction change or meaningful dramatic beat"
            ))

        shot["cameraGrammar"] = {
            "shotSize": size,
            "focusActor": focus,
            "axis": camera_side,
            "movement": movement,
            "cutReason": cut_reason,
            "previousShotSize": previous_size,
            "eyelineRule": "preserve reciprocal eyelines and screen direction from established blocking",
        }
        shot["prompt"] = (
            str(shot.get("prompt") or "")
            + f" CAMERA GRAMMAR: shotSize={size}; focus={focus}; axis={camera_side}; movement={movement}; "
            + f"cutReason={cut_reason}. Preserve reciprocal eyelines and the established 180-degree screen direction. "
            + "Do not jump to an unrelated camera position merely for visual variety."
        )
        previous_size = size

    return {
        "status": "planned",
        "scene": planned,
        "policy": {
            "preserve180DegreeAxis": True,
            "cutsNeedMotivation": True,
            "eyelinesFollowBlocking": True,
            "visioNeverUsesExternalCamera": True,
            "cameraNoveltyNeverOverridesContinuity": True,
        },
    }
