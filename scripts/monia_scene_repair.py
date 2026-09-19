from __future__ import annotations

import json
from pathlib import Path
from typing import Any


REJECTION_REASONS = {
    "identity-drift",
    "face-blend",
    "anatomy",
    "temporal-morphing",
    "continuity",
    "eyeline-geography",
    "performance",
    "tattoo-wardrobe-prop",
}


def normalize_evaluation(raw: dict[str, Any], expected_shots: list[dict[str, Any]]) -> dict[str, Any]:
    incoming = {str(x.get("shotId")): x for x in raw.get("shots") or []}
    decisions = []
    for shot in expected_shots:
        shot_id = str(shot.get("id"))
        item = incoming.get(shot_id)
        if not item:
            decisions.append({
                "shotId": shot_id,
                "decision": "review-required",
                "reasons": ["missing-evaluation"],
                "confidence": 0.0,
            })
            continue
        decision = str(item.get("decision") or "review-required").lower()
        reasons = [str(r) for r in item.get("reasons") or []]
        confidence = float(item.get("confidence") or 0.0)
        if decision == "approve" and confidence < 0.80:
            decision = "review-required"
            reasons.append("low-confidence")
        if decision == "reject" and not any(r in REJECTION_REASONS for r in reasons):
            reasons.append("unspecified-semantic-failure")
        decisions.append({
            "shotId": shot_id,
            "decision": decision if decision in {"approve", "reject"} else "review-required",
            "reasons": sorted(set(reasons)),
            "confidence": confidence,
            "notes": item.get("notes"),
        })
    return {
        "status": "complete" if all(d["decision"] in {"approve", "reject"} for d in decisions) else "review-required",
        "shots": decisions,
        "approved": [d["shotId"] for d in decisions if d["decision"] == "approve"],
        "rejected": [d["shotId"] for d in decisions if d["decision"] == "reject"],
    }


def build_repair_job(scene: dict[str, Any], evaluation: dict[str, Any]) -> dict[str, Any] | None:
    rejected = {str(x) for x in evaluation.get("rejected") or []}
    if not rejected:
        return None
    reasons = {str(x.get("shotId")): x.get("reasons") or [] for x in evaluation.get("shots") or []}
    repair_shots = []
    for shot in scene.get("shots") or []:
        shot_id = str(shot.get("id"))
        if shot_id not in rejected:
            continue
        repaired = dict(shot)
        repaired["repairOf"] = shot_id
        repaired["qaRejectionReasons"] = reasons.get(shot_id) or []
        repaired["prompt"] = (
            str(shot.get("prompt") or "")
            + " REPAIR PASS: Correct only these rejected defects: "
            + ", ".join(repaired["qaRejectionReasons"])
            + ". Preserve every already-correct identity, wardrobe, prop, spatial and performance detail."
        )
        repair_shots.append(repaired)
    return {
        **scene,
        "id": f"{scene.get('id')}-repair",
        "repairPass": True,
        "repairSourceScene": scene.get("id"),
        "shots": repair_shots,
        "approvalRequired": True,
        "autoPublish": False,
    }


def write_repair(scene: dict[str, Any], raw_evaluation: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    evaluation = normalize_evaluation(raw_evaluation, scene.get("shots") or [])
    (output_dir / "qa-decision.json").write_text(json.dumps(evaluation, ensure_ascii=False, indent=2), encoding="utf-8")
    repair = build_repair_job(scene, evaluation)
    if repair:
        (output_dir / "repair-job.json").write_text(json.dumps(repair, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"evaluation": evaluation, "repairJob": repair}
