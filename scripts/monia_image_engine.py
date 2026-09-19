from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any

from gradio_client import Client, handle_file


def _materialize(value: Any, target: Path) -> None:
    candidates = []
    if isinstance(value, str):
        candidates.append(value)
    elif isinstance(value, dict):
        for key in ("path", "name", "url", "image"):
            if value.get(key):
                candidates.append(value[key])
    elif isinstance(value, (list, tuple)):
        for item in value:
            if isinstance(item, str):
                candidates.append(item)
            elif isinstance(item, dict):
                for key in ("path", "name"):
                    if item.get(key):
                        candidates.append(item[key])
    for candidate in candidates:
        p = Path(str(candidate))
        if p.exists() and p.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, target)
            return
    raise RuntimeError("Image compositor returned no local image result")


def generate_anchor_candidate(request: dict[str, Any], output: Path) -> dict[str, Any]:
    space = os.environ.get("MONIA_IMAGE_SPACE", "").strip()
    api_name = os.environ.get("MONIA_IMAGE_API_NAME", "").strip()
    if not space or not api_name:
        return {
            "status": "backend-not-configured",
            "output": None,
            "reason": "Set MONIA_IMAGE_SPACE and MONIA_IMAGE_API_NAME to an approved image-to-image compositor.",
            "approvalRequired": True,
        }

    board = str(request.get("identityBoard") or "")
    if not board or not Path(board).exists():
        raise RuntimeError("Identity board missing")

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(space, token=token, verbose=False)
    # Adapter contract: image, positive prompt, negative prompt.
    # A provider-specific adapter can replace this without changing scene logic.
    result = client.predict(
        handle_file(board),
        str(request.get("prompt") or ""),
        str(request.get("negative") or ""),
        api_name=api_name,
    )
    _materialize(result, output)
    if output.stat().st_size < 2048:
        raise RuntimeError("Generated anchor candidate is too small")

    manifest = {
        "status": "candidate",
        "output": str(output),
        "provider": space,
        "apiName": api_name,
        "approvalRequired": True,
        "autoApprove": False,
        "semanticIdentityReviewRequired": True,
    }
    output.with_suffix(".candidate.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest
