from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def anchor_fingerprint(contract: dict[str, Any]) -> str:
    payload = {
        "actors": contract.get("actors") or [],
        "references": contract.get("references") or {},
        "blockingState": contract.get("blockingState") or {},
        "cameraGrammar": contract.get("cameraGrammar") or {},
        "environmentContinuity": contract.get("environmentContinuity") or {},
        "appearance": contract.get("appearance") or {},
        "wardrobe": contract.get("wardrobe") or {},
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:24]


def find_validated_anchor(contract: dict[str, Any], library_dir: Path) -> dict[str, Any] | None:
    fingerprint = anchor_fingerprint(contract)
    manifest = library_dir / f"{fingerprint}.json"
    image = library_dir / f"{fingerprint}.png"
    if not manifest.exists() or not image.exists() or image.stat().st_size < 2048:
        return None
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except Exception:
        return None
    if data.get("status") != "validated" or data.get("fingerprint") != fingerprint:
        return None
    return {
        "status": "validated",
        "fingerprint": fingerprint,
        "sourcePath": str(image),
        "actors": data.get("actors") or contract.get("actors") or [],
        "semanticReview": data.get("semanticReview"),
        "reused": True,
    }


def register_validated_anchor(contract: dict[str, Any], source: Path, library_dir: Path, semantic_review: dict[str, Any]) -> dict[str, Any]:
    if semantic_review.get("status") != "approved":
        raise RuntimeError("Anchor cannot enter validated library without approved semantic identity review")
    library_dir.mkdir(parents=True, exist_ok=True)
    fingerprint = anchor_fingerprint(contract)
    image = library_dir / f"{fingerprint}.png"
    image.write_bytes(source.read_bytes())
    manifest = {
        "status": "validated",
        "fingerprint": fingerprint,
        "actors": contract.get("actors") or [],
        "semanticReview": semantic_review,
        "source": str(source),
    }
    (library_dir / f"{fingerprint}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {**manifest, "sourcePath": str(image), "reused": False}
