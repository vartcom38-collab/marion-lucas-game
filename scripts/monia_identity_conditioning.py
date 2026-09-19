from __future__ import annotations

from pathlib import Path
from typing import Any


def identity_conditioning_plan(shot: dict[str, Any], actor_references: dict[str, Any] | None = None) -> dict[str, Any]:
    actors = [str(a) for a in shot.get("actors") or []]
    refs = actor_references or {}
    resolved = {actor: refs.get(actor) for actor in actors if refs.get(actor)}
    missing = [actor for actor in actors if actor not in resolved]

    if len(actors) <= 1:
        return {
            "mode": "single-reference-i2v",
            "status": "ready" if not missing else "reference-required",
            "actors": actors,
            "references": resolved,
            "missingReferences": missing,
            "anchorRequired": False,
        }

    return {
        "mode": "composite-anchor-i2v",
        "status": "anchor-required" if not missing else "references-and-anchor-required",
        "actors": actors,
        "references": resolved,
        "missingReferences": missing,
        "anchorRequired": True,
        "anchorRequirements": {
            "allActorsVisibleAndSeparatelyRecognizable": True,
            "blockingMustMatchShot": True,
            "wardrobeMustMatchContinuity": True,
            "cameraAndEyelinesMustMatchPlan": True,
            "noFaceBlending": True,
            "semanticIdentityApprovalRequiredBeforeVideo": True,
        },
        "reason": "Current MonIA Wan/LTX providers accept one image input per i2v request. Multiple identities must therefore be composed and approved in one anchor frame before animation.",
    }


def assert_video_conditioning_ready(plan: dict[str, Any], anchor_path: Path | None = None) -> None:
    if plan.get("missingReferences"):
        raise RuntimeError("Missing canonical actor references: " + ", ".join(plan["missingReferences"]))
    if plan.get("anchorRequired"):
        if anchor_path is None or not anchor_path.exists() or anchor_path.stat().st_size < 2048:
            raise RuntimeError("Multi-character shot requires a validated composite anchor image before video generation.")
