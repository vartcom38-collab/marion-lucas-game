from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts.monia_scene_repair import normalize_evaluation, build_repair_job
from scripts.monia_scene_worker import run_job


def merge_repaired_shots(
    original_result: dict[str, Any],
    repair_result: dict[str, Any],
    evaluation: dict[str, Any],
) -> dict[str, Any]:
    rejected = set(evaluation.get("rejected") or [])
    repaired = {str(s.get("repairOf") or s.get("id")): s for s in repair_result.get("shots") or []}
    merged = []
    for shot in original_result.get("shots") or []:
        shot_id = str(shot.get("id"))
        if shot_id not in rejected:
            kept = dict(shot)
            kept["qaDisposition"] = "kept-approved"
            merged.append(kept)
            continue
        replacement = repaired.get(shot_id)
        if replacement and replacement.get("status") == "candidate-ready":
            item = dict(replacement)
            item["id"] = shot_id
            item["qaDisposition"] = "repaired-replacement"
            merged.append(item)
        else:
            item = dict(shot)
            item["qaDisposition"] = "rejected-unrepaired"
            merged.append(item)
    return {
        **original_result,
        "shots": merged,
        "repairApplied": True,
        "rejectedShotIds": sorted(rejected),
        "status": "candidate-ready" if all(s.get("qaDisposition") != "rejected-unrepaired" for s in merged) else "candidate-partial",
    }


def execute_repair_pass(
    scene: dict[str, Any],
    original_result: dict[str, Any],
    raw_evaluation: dict[str, Any],
    work_dir: Path,
    publish_candidates: bool = False,
    pass_number: int = 1,
    max_passes: int = 2,
) -> dict[str, Any]:
    if pass_number > max_passes:
        return {"status": "manual-review-required", "reason": "maximum-repair-passes-reached"}
    evaluation = normalize_evaluation(raw_evaluation, scene.get("shots") or [])
    repair_job = build_repair_job(scene, evaluation)
    if not repair_job:
        return {"status": "nothing-to-repair", "evaluation": evaluation, "merged": original_result}

    repair_job["repairPassNumber"] = pass_number
    repair_job["maxRepairPasses"] = max_passes
    job_path = work_dir / f"repair-pass-{pass_number}.json"
    job_path.parent.mkdir(parents=True, exist_ok=True)
    job_path.write_text(json.dumps(repair_job, ensure_ascii=False, indent=2), encoding="utf-8")
    repair_result = run_job(job_path, publish_candidates)
    merged = merge_repaired_shots(original_result, repair_result, evaluation)
    result = {
        "status": "repair-applied" if merged.get("status") == "candidate-ready" else "repair-partial",
        "passNumber": pass_number,
        "maxPasses": max_passes,
        "evaluation": evaluation,
        "repairResult": repair_result,
        "merged": merged,
    }
    (work_dir / f"repair-result-{pass_number}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result
