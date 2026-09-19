from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageOps, ImageDraw


def _load_image(source: str) -> Image.Image:
    if source.startswith("http://") or source.startswith("https://"):
        r = requests.get(source, timeout=30, headers={"Cache-Control": "no-cache"})
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")
    return Image.open(source).convert("RGB")


def _slot_box(index: int, count: int, width: int, height: int) -> tuple[int, int, int, int]:
    margin_x = int(width * 0.06)
    top = int(height * 0.08)
    bottom = int(height * 0.94)
    usable = width - margin_x * 2
    slot = usable / max(1, count)
    left = int(margin_x + index * slot)
    right = int(margin_x + (index + 1) * slot)
    return left, top, right, bottom


def compose_identity_board(contract: dict[str, Any], output: Path, width: int = 960, height: int = 544) -> dict[str, Any]:
    actors = [str(a) for a in contract.get("actors") or []]
    refs = contract.get("references") or {}
    if len(actors) < 2:
        raise RuntimeError("Composite identity board is only needed for multi-character shots")
    missing = [a for a in actors if not refs.get(a)]
    if missing:
        raise RuntimeError("Missing actor references: " + ", ".join(missing))

    canvas = Image.new("RGB", (width, height), (118, 118, 118))
    draw = ImageDraw.Draw(canvas)
    slots = []

    for index, actor in enumerate(actors):
        left, top, right, bottom = _slot_box(index, len(actors), width, height)
        ref = _load_image(str(refs[actor]))
        target_w = max(1, right - left)
        target_h = max(1, bottom - top)
        fitted = ImageOps.fit(ref, (target_w, target_h), method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))
        canvas.paste(fitted, (left, top))
        draw.rectangle((left, top, right - 1, bottom - 1), outline=(225, 225, 225), width=2)
        slots.append({
            "actor": actor,
            "box": [left, top, right, bottom],
            "reference": refs[actor],
            "blocking": (contract.get("blockingState") or {}).get(actor) or {},
        })

    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, "PNG", optimize=True)
    result = {
        "status": "candidate-reference-board",
        "output": str(output),
        "actors": actors,
        "slots": slots,
        "purpose": "identity/layout conditioning input only",
        "limitations": [
            "This deterministic board preserves source identity pixels but is not yet a photorealistic shared scene.",
            "It does not prove semantic identity preservation after generative composition.",
            "A generative anchor compositor and semantic identity approval are still required before video.",
        ],
        "approvalRequired": True,
        "autoValidate": False,
    }
    output.with_suffix(".json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result
