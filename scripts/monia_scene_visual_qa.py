from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def build_visual_qa_contract(scene: dict[str, Any], video_result: dict[str, Any]) -> dict[str, Any]:
    continuity = scene.get("continuityState") or {}
    checks = []
    for shot in video_result.get("shots") or []:
        checks.append({
            "shotId": shot.get("id"),
            "candidate": shot.get("path"),
            "status": "visual-review-required",
            "requiredChecks": [
                "canonical face identity preserved for every visible recurring character",
                "no face blending, swapping or identity averaging",
                "body proportions and relative character height remain plausible",
                "hair, wardrobe, tattoos and persistent props match continuity state",
                "hands, teeth, eyes and limbs contain no obvious generative deformation",
                "screen direction, eyelines and character geography remain coherent",
                "motion is temporally stable without morphing, flicker or sudden texture changes",
                "facial performance matches the dramatic beat and does not look frozen or advertisement-posed",
            ],
        })
    return {
        "version": 1,
        "sceneId": scene.get("id"),
        "status": "review-required",
        "continuityReference": continuity,
        "shots": checks,
        "policy": {
            "technicalMp4ValidityIsNotVisualApproval": True,
            "identityFailureRejectsShot": True,
            "continuityFailureRejectsShot": True,
            "obviousAnatomyFailureRejectsShot": True,
            "temporalMorphingRejectsShot": True,
            "approvalRequiresSemanticVisionEvaluator": True,
            "neverAutoApproveWithoutEvaluator": True,
        },
    }


def write_contract(scene: dict[str, Any], video_result: dict[str, Any], output: Path) -> dict[str, Any]:
    contract = build_visual_qa_contract(scene, video_result)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(contract, ensure_ascii=False, indent=2), encoding="utf-8")
    return contract
