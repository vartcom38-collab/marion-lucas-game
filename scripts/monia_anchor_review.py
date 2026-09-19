from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts.monia_anchor_library import register_validated_anchor
from scripts.monia_anchor_repair import build_anchor_repair_request
from scripts.monia_image_engine import generate_anchor_candidate


def apply_anchor_reviews(
    anchor_plan: dict[str, Any],
    review_file: Path,
    library_dir: Path,
) -> dict[str, Any]:
    reviews = json.loads(review_file.read_text(encoding="utf-8"))
    by_shot = {str(x.get("shotId")): x for x in (reviews.get("shots") or [])}
    approved = []
    rejected = []
    pending = []

    for item in anchor_plan.get("shots") or []:
        shot_id = str(item.get("shotId"))
        if item.get("status") in {"not-required", "validated-reuse"}:
            continue
        review = by_shot.get(shot_id)
        if not review:
            pending.append(shot_id)
            continue
        status = str(review.get("status") or "").lower()
        if status != "approved":
            request_path = Path(str(item.get("compositeRequest") or ""))
            previous_candidate = Path(str((item.get("candidate") or {}).get("output") or ""))
            repair_pass = int(review.get("repairPass") or 0)
            if request_path.exists() and repair_pass < 2:
                original_request = json.loads(request_path.read_text(encoding="utf-8"))
                repair_request = build_anchor_repair_request(original_request, review)
                repair_request["repairPass"] = repair_pass + 1
                repair_dir = library_dir.parent / "anchor-repairs"
                repair_dir.mkdir(parents=True, exist_ok=True)
                repair_request_path = repair_dir / f"{shot_id}-repair-{repair_pass + 1}.json"
                repair_request_path.write_text(json.dumps(repair_request, ensure_ascii=False, indent=2), encoding="utf-8")
                repair_output = repair_dir / f"{shot_id}-repair-{repair_pass + 1}.png"
                repair_candidate = generate_anchor_candidate(repair_request, repair_output)
                rejected.append({
                    "shotId": shot_id,
                    "review": review,
                    "repairPass": repair_pass + 1,
                    "repairRequest": str(repair_request_path),
                    "repairCandidate": repair_candidate,
                    "previousCandidate": str(previous_candidate) if previous_candidate else None,
                    "next": "semantic-review-repair-candidate" if repair_candidate.get("status") == "candidate" else "retry-compute",
                })
            else:
                rejected.append({"shotId": shot_id, "review": review, "next": "manual-director-revision"})
            continue

        contract_path = Path(str(item.get("contract")))
        candidate_path = Path(str((item.get("candidate") or {}).get("output") or ""))
        if not contract_path.exists() or not candidate_path.exists():
            rejected.append({"shotId": shot_id, "reason": "approved-review-missing-contract-or-candidate"})
            continue
        contract = json.loads(contract_path.read_text(encoding="utf-8"))
        registered = register_validated_anchor(contract, candidate_path, library_dir, review)
        approved.append({"shotId": shot_id, "anchor": registered})

    return {
        "status": "approved" if not rejected and not pending else ("rejected" if rejected else "pending"),
        "approved": approved,
        "rejected": rejected,
        "pending": pending,
    }
