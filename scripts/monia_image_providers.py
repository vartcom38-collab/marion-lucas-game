from __future__ import annotations

import os
from typing import Any


def image_provider_chain() -> list[dict[str, Any]]:
    providers = []

    # Primary configurable remote compositor. Never mandatory.
    space = os.environ.get("MONIA_IMAGE_SPACE", "").strip()
    if space:
        providers.append({
            "id": "configured-qwen-compose",
            "kind": "gradio",
            "space": space,
            "apiName": os.environ.get("MONIA_IMAGE_API_NAME", "").strip() or "/on_compose_generate",
            "mode": os.environ.get("MONIA_IMAGE_MODE", "qwen-compose").strip(),
        })

    # Optional extra providers can be injected without changing code:
    # id|space|api|mode;id2|space2|api2|mode2
    raw = os.environ.get("MONIA_IMAGE_FALLBACKS", "").strip()
    for entry in [x.strip() for x in raw.split(";") if x.strip()]:
        parts = [x.strip() for x in entry.split("|")]
        if len(parts) >= 2:
            providers.append({
                "id": parts[0],
                "kind": "gradio",
                "space": parts[1],
                "apiName": parts[2] if len(parts) > 2 and parts[2] else "/on_compose_generate",
                "mode": parts[3] if len(parts) > 3 and parts[3] else "qwen-compose",
            })

    return providers


def provider_policy() -> dict[str, Any]:
    return {
        "externalProviderIsOptional": True,
        "neverBlockWholeSceneOnSingleProvider": True,
        "reuseValidatedAnchorBeforeCompute": True,
        "preserveCandidateOnFailure": True,
        "resumeFromCheckpoint": True,
        "providerCircuitBreaker": True,
        "localSelfHostedProviderCanBeInsertedFirst": True,
    }
