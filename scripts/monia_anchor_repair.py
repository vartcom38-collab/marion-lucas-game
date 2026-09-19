from __future__ import annotations

from copy import deepcopy
from typing import Any


def build_anchor_repair_request(
    original_request: dict[str, Any],
    review: dict[str, Any],
) -> dict[str, Any]:
    repaired = deepcopy(original_request)
    failures = review.get("failures") or review.get("reasons") or []
    failed_actors = review.get("failedActors") or []
    approved_actors = review.get("approvedActors") or []

    repaired["task"] = "targeted-multi-character-anchor-repair"
    repaired["repair"] = {
        "failedActors": failed_actors,
        "approvedActors": approved_actors,
        "failures": failures,
        "preserveApprovedPixelsAndIdentity": True,
        "changeOnlyRejectedElements": True,
    }
    repaired["prompt"] = (
        str(original_request.get("prompt") or "") +
        " TARGETED REPAIR: preserve all already approved characters, composition, camera, lighting, "
        "wardrobe and background. Correct only these rejected actors/elements: " +
        ", ".join([str(x) for x in failed_actors + failures]) +
        ". Do not redesign the scene. Do not alter approved faces."
    )
    repaired["outputStatus"] = "repair-candidate-only"
    repaired["autoApprove"] = False
    return repaired
