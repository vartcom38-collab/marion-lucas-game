from __future__ import annotations

import json
from pathlib import Path
from typing import Any


BUILTIN_CANON = {
    "lucas": {
        "displayName": "Dominic",
        "reference": "https://marion-lucas.marionbolomey.fr/resources/monia/canon/lucas/reference.jpg",
    },
    "marion": {
        "displayName": "Marion",
        "reference": "public/resources/photo.png",
    },
}


def build_identity_review(scene: dict[str, Any], samples: dict[str, Any]) -> dict[str, Any]:
    sample_map = {str(s.get("shotId")): s for s in samples.get("samples") or []}
    actor_refs = scene.get("actorReferences") or {}
    reviews = []
    for shot in scene.get("shots") or []:
        actors = [str(a) for a in shot.get("actors") or []]
        identities = []
        for actor in actors:
            key = actor.lower()
            builtin = BUILTIN_CANON.get(key)
            reference = builtin["reference"] if builtin else actor_refs.get(actor)
            identities.append({
                "actor": actor,
                "displayName": builtin["displayName"] if builtin else actor,
                "canonicalReference": reference,
                "status": "ready-for-semantic-comparison" if reference else "blocked-no-canon",
                "requiredDecision": {
                    "sameIdentity": "boolean",
                    "confidence": "0..1",
                    "failureReasons": [
                        "face-shape-drift",
                        "eyes-nose-mouth-drift",
                        "hair-or-facial-hair-drift",
                        "age-drift",
                        "body-proportion-drift",
                        "identity-blend-or-swap",
                    ],
                },
            })
        sample = sample_map.get(str(shot.get("id"))) or {}
        reviews.append({
            "shotId": shot.get("id"),
            "frames": sample.get("frames") or [],
            "identities": identities,
            "policy": "Compare every sampled frame, not only the first frame. Any recurring-character identity swap or strong drift rejects the shot.",
        })
    return {
        "version": 1,
        "sceneId": scene.get("id"),
        "status": "semantic-evaluator-required",
        "shots": reviews,
        "approvalRule": {
            "allVisibleCanonicalActorsMustMatch": True,
            "minimumSemanticConfidence": 0.88,
            "lowConfidenceAction": "review-required",
            "identityFailureAction": "reject-shot",
            "neverApproveFromPixelSimilarityAlone": True,
        },
    }


def write_identity_review(scene: dict[str, Any], samples: dict[str, Any], output: Path) -> dict[str, Any]:
    payload = build_identity_review(scene, samples)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload
