from __future__ import annotations

from pathlib import Path
import os
from typing import Any
import json

from scripts.monia_identity_conditioning import identity_conditioning_plan
from scripts.monia_anchor_compositor import compose_identity_board
from scripts.monia_anchor_library import find_validated_anchor
from scripts.monia_anchor_generator import build_composite_request
from scripts.monia_image_engine import generate_anchor_candidate


def prepare_scene_anchors(scene: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    library_dir = Path(os.environ.get("MONIA_ANCHOR_LIBRARY_DIR", ".monia-video/anchor-library"))
    library_dir.mkdir(parents=True, exist_ok=True)
    job_refs = scene.get("actorReferences") or {}
    items = []
    blocked = []

    for index, shot in enumerate(scene.get("shots") or []):
        actors = [str(a) for a in shot.get("actors") or []]
        refs = {}
        for actor in actors:
            key = actor.strip().lower()
            if key in {"lucas", "dominic"}:
                refs[actor] = "https://marion-lucas.marionbolomey.fr/resources/monia/canon/lucas/reference.jpg"
            elif key == "marion":
                refs[actor] = "https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main/public/resources/photo.png"
            else:
                explicit = (shot.get("actorReferences") or {}).get(actor) or job_refs.get(actor)
                if explicit:
                    refs[actor] = str(explicit)

        conditioning = identity_conditioning_plan({"actors": actors}, refs)
        if not conditioning.get("anchorRequired"):
            items.append({"shotId": shot.get("id"), "status": "not-required", "conditioning": conditioning})
            continue

        shot_id = str(shot.get("id") or f"shot-{index+1:02d}")
        contract = {
            "shotId": shot_id,
            "status": "awaiting-composite",
            "actors": actors,
            "references": refs,
            "blockingState": shot.get("blockingState") or {},
            "cameraGrammar": shot.get("cameraGrammar") or {},
            "environmentContinuity": shot.get("environmentContinuity") or {},
            "appearance": (scene.get("continuityState") or {}).get("appearance") or {},
            "wardrobe": (scene.get("continuityState") or {}).get("wardrobe") or {},
            "requiredOutput": str(output_dir / f"{shot_id}-anchor.png"),
            "validation": conditioning.get("anchorRequirements") or {},
            "rules": [
                "Compose the exact visible actors only.",
                "Preserve each canonical identity separately; never blend or average faces.",
                "Match planned blocking, screen side, eyelines, wardrobe, lighting and camera perspective.",
                "This is a still identity/layout anchor, not final artwork.",
                "Do not animate until semantic identity review validates every visible canonical actor.",
            ],
        }
        contract_path = output_dir / f"{shot_id}-anchor-contract.json"
        contract_path.write_text(json.dumps(contract, ensure_ascii=False, indent=2), encoding="utf-8")

        reused = find_validated_anchor(contract, library_dir)
        if reused:
            shot["sceneAnchor"] = {
                "status": "validated",
                "actors": actors,
                "requiredActors": actors,
                "sourcePath": reused["sourcePath"],
                "fingerprint": reused["fingerprint"],
            }
            items.append({"shotId": shot_id, "status": "validated-reuse", "contract": str(contract_path), "anchor": reused, "conditioning": conditioning})
            continue

        board = compose_identity_board(contract, output_dir / f"{shot_id}-identity-board.png")
        composite_request = build_composite_request(contract, board)
        request_path = output_dir / f"{shot_id}-composite-request.json"
        request_path.write_text(json.dumps(composite_request, ensure_ascii=False, indent=2), encoding="utf-8")
        candidate = generate_anchor_candidate(composite_request, output_dir / f"{shot_id}-anchor-candidate.png")
        item = {
            "shotId": shot_id,
            "status": "awaiting-semantic-anchor-review" if candidate.get("status") == "candidate" else candidate.get("status"),
            "contract": str(contract_path),
            "identityBoard": board,
            "compositeRequest": str(request_path),
            "candidate": candidate,
            "conditioning": conditioning,
        }
        items.append(item)
        blocked.append(shot_id)

    result = {
        "status": "anchors-required" if blocked else "ready",
        "blockedShots": blocked,
        "shots": items,
        "policy": {
            "multiCharacterVideoCannotStartWithoutValidatedAnchor": True,
            "semanticIdentityReviewRequired": True,
            "approvedAnchorCanBeReused": True,
        },
    }
    (output_dir / "anchor-plan.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result
