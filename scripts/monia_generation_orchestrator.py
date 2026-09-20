from __future__ import annotations

from dataclasses import dataclass
from typing import Any

POLICIES = {"autonomous-first", "quality-first", "magnific-assisted", "compare"}

@dataclass(frozen=True)
class GenerationDecision:
    provider: str
    reason: str
    requires_external_approval: bool
    learning_capture: bool = True

def route_generation(job: dict[str, Any]) -> GenerationDecision:
    """Choose compute without making Magnific a hard dependency."""
    policy = str(job.get("generationPolicy") or "autonomous-first")
    if policy not in POLICIES:
        raise ValueError(f"Unknown generationPolicy: {policy}")
    generation = job.get("generation") or {}
    characters = job.get("characters") or []
    location = job.get("location") or {}
    difficult_identity = len(characters) > 1
    real_location = bool(location.get("realWorld"))
    allow_paid = bool(job.get("allowPaidExternal", False))

    wants_magnific = policy in {"magnific-assisted", "compare"}
    needs_teacher = policy == "quality-first" and (difficult_identity or real_location)
    if wants_magnific or needs_teacher:
        if not allow_paid:
            return GenerationDecision(
                "monia",
                "Magnific would help this scene, but paid external generation is locked; use MonIA and capture the gap for a later teacher pass.",
                True,
            )
        return GenerationDecision(
            "magnific",
            "Teacher/support pass selected for identity, real-location fidelity or comparison. The result must still pass MonIA review.",
            True,
        )

    requested = str(generation.get("router") or "auto")
    return GenerationDecision(
        "monia",
        f"Autonomous-first route using MonIA router={requested}; Magnific remains available as a later teacher/repair pass.",
        False,
    )

def build_learning_trace(job: dict[str, Any], decision: GenerationDecision) -> dict[str, Any]:
    """Persist what MonIA can learn from every attempt without claiming model-weight training."""
    return {
        "version": 1,
        "jobId": job.get("id"),
        "sceneFamily": job.get("sceneFamily"),
        "playableContext": job.get("playableContext"),
        "location": job.get("location"),
        "characters": job.get("characters"),
        "wardrobeContinuity": job.get("wardrobeContinuity"),
        "prompt": job.get("prompt"),
        "negativePrompt": job.get("negativePrompt"),
        "generationPolicy": job.get("generationPolicy", "autonomous-first"),
        "selectedProvider": decision.provider,
        "routingReason": decision.reason,
        "references": job.get("references"),
        "result": {"status": "pending", "asset": None},
        "qa": {},
        "repairs": [],
        "userVerdict": None,
        "lesson": {
            "promptRecipe": None,
            "referenceRecipe": None,
            "failureModes": [],
            "reuseFor": [],
        },
    }
