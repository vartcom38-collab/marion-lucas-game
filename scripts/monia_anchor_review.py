from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts.monia_anchor_library import register_validated_anchor


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
            rejected.append({"shotId": shot_id, "review": review})
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
