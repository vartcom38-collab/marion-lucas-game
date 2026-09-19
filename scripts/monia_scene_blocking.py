from __future__ import annotations

from copy import deepcopy
from typing import Any


def plan_blocking(scene: dict[str, Any]) -> dict[str, Any]:
    planned = deepcopy(scene)
    spatial = (planned.get("continuityState") or {}).get("spatial") or {}
    state: dict[str, dict[str, Any]] = {}
    changes = []

    for actor, value in spatial.items():
        if isinstance(value, dict):
            state[str(actor)] = dict(value)
        else:
            state[str(actor)] = {"position": value}

    for index, shot in enumerate(planned.get("shots") or []):
        actors = [str(a) for a in shot.get("actors") or []]
        entrances = [str(a) for a in shot.get("entrances") or []]
        exits = [str(a) for a in shot.get("exits") or []]
        override = shot.get("blocking") or {}

        for actor in exits:
            state.pop(actor, None)
        for actor in actors:
            state.setdefault(actor, {
                "position": "preserve from previous shot" if index else "natural position established by first shot",
                "facing": "toward current interaction",
                "screenSide": "preserve established screen side",
            })
        for actor in entrances:
            state.setdefault(actor, {})
            state[actor].update({
                "position": override.get(actor, {}).get("position", "enter from a motivated off-screen direction"),
                "facing": override.get(actor, {}).get("facing", "toward the interaction"),
                "screenSide": override.get(actor, {}).get("screenSide", "establish once, then preserve"),
            })
        for actor, values in override.items():
            if actor in actors and isinstance(values, dict):
                state.setdefault(actor, {}).update(values)
                changes.append({"shotId": shot.get("id"), "actor": actor, "blocking": values})

        visible_state = {a: deepcopy(state.get(a, {})) for a in actors}
        shot["blockingState"] = visible_state
        shot["prompt"] = (
            str(shot.get("prompt") or "")
            + " PHYSICAL BLOCKING: "
            + "; ".join(
                f"{actor}: position={data.get('position')}, facing={data.get('facing')}, screenSide={data.get('screenSide')}"
                for actor, data in visible_state.items()
            )
            + ". Preserve these physical relationships across the cut unless this beat explicitly changes them."
        )

    return {
        "status": "planned",
        "scene": planned,
        "changes": changes,
        "policy": {
            "preserveScreenDirection": True,
            "preserveRelativePosition": True,
            "entrancesNeedMotivatedDirection": True,
            "noTeleportingBetweenCuts": True,
        },
    }
