from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def build_composite_request(contract: dict[str, Any], identity_board: dict[str, Any]) -> dict[str, Any]:
    actors = contract.get("actors") or []
    return {
        "status": "ready-for-image-compositor",
        "task": "multi-character-photorealistic-anchor",
        "actors": actors,
        "identityBoard": identity_board.get("output"),
        "references": contract.get("references") or {},
        "blockingState": contract.get("blockingState") or {},
        "cameraGrammar": contract.get("cameraGrammar") or {},
        "environmentContinuity": contract.get("environmentContinuity") or {},
        "appearance": contract.get("appearance") or {},
        "wardrobe": contract.get("wardrobe") or {},
        "prompt": (
            "Create one photorealistic live-action still frame for image-to-video conditioning. "
            "Show only the listed actors. Preserve every supplied canonical identity separately and exactly. "
            "Match blocking, screen side, eyelines, wardrobe, environment, lighting and camera grammar. "
            "Natural skin texture and anatomy. This is a believable frame from the scene, not a collage."
        ),
        "negative": (
            "face blend, face swap, averaged identity, duplicate person, extra person, identity drift, "
            "generic model face, deformed hands, extra fingers, malformed eyes, plastic skin, collage seams, "
            "split screen, labels, text, subtitles, watermark, UI"
        ),
        "acceptance": {
            "allActorsSeparatelyRecognizable": True,
            "noIdentityBlend": True,
            "blockingMatches": True,
            "cameraMatches": True,
            "continuityMatches": True,
            "anatomyPlausible": True,
            "semanticReviewRequired": True,
        },
        "outputStatus": "candidate-only",
        "autoApprove": False,
    }


def write_composite_request(contract_path: Path, identity_board_path: Path, output_path: Path) -> dict[str, Any]:
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    board_manifest = identity_board_path.with_suffix(".json")
    if not board_manifest.exists():
        raise RuntimeError("Identity board manifest missing")
    board = json.loads(board_manifest.read_text(encoding="utf-8"))
    request = build_composite_request(contract, board)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding="utf-8")
    return request
