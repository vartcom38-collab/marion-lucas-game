from __future__ import annotations

from copy import deepcopy
from typing import Any


def plan_human_behavior(scene: dict[str, Any]) -> dict[str, Any]:
    planned = deepcopy(scene)
    previous: dict[str, str] = {}

    for index, shot in enumerate(planned.get("shots") or []):
        actors = [str(a) for a in shot.get("actors") or []]
        speaker = str(shot.get("speaker") or "").strip()
        behavior: dict[str, dict[str, str]] = {}

        for actor_index, actor in enumerate(actors):
            if actor == speaker:
                primary = "speak while continuing a simple physical activity; do not stop the body to deliver the line"
                gaze = "alternate naturally between the listener, the immediate task and brief thought-driven gaze breaks"
            else:
                primary = "continue a small context-appropriate activity while listening; reaction can begin before the speaker finishes"
                gaze = "look toward the speaker when motivated, then allow brief natural gaze breaks; never stare continuously"

            candidates = [
                "subtle weight shift and breathing",
                "brief hand adjustment connected to clothing or a nearby prop",
                "small posture change motivated by comfort or attention",
                "tiny head movement and irregular blink timing",
                "brief stillness followed by a restrained reaction",
            ]
            secondary = candidates[(index + actor_index) % len(candidates)]
            if previous.get(actor) == secondary:
                secondary = candidates[(index + actor_index + 1) % len(candidates)]
            previous[actor] = secondary
            behavior[actor] = {
                "primary": primary,
                "secondary": secondary,
                "gaze": gaze,
                "antiPattern": "avoid repeated signature gestures, synchronized movement, constant nodding, posing, or exaggerated mime",
            }

        shot["humanBehavior"] = behavior
        shot["prompt"] = (
            str(shot.get("prompt") or "")
            + " HUMAN BEHAVIOR: "
            + "; ".join(
                f"{actor}: {data['primary']}; {data['secondary']}; gaze={data['gaze']}"
                for actor, data in behavior.items()
            )
            + ". Keep behavior sparse and context-driven. Do not make every character move at once. "
            + "Avoid repeated AI-like gesture loops, constant nodding, fixed staring, symmetrical poses and advertisement-style presentation."
        )

    return {
        "status": "planned",
        "scene": planned,
        "policy": {
            "movementMustHaveContext": True,
            "avoidGestureLoops": True,
            "avoidSynchronizedActors": True,
            "speakerBodyDoesNotFreeze": True,
            "listenerReactsBeforeAndAfterLines": True,
        },
    }
