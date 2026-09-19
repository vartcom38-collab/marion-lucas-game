from __future__ import annotations

import json
import os
import shutil
import multiprocessing as mp
from queue import Empty
from pathlib import Path
from typing import Any

from gradio_client import Client, handle_file
from scripts.monia_image_providers import image_provider_chain, provider_policy


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


def _predict_child(space: str, token: str | None, api_name: str, args: list[Any], queue) -> None:
    try:
            result = client.predict(*args, api_name=api_name)
        queue.put({"ok": True, "result": result})
    except Exception as exc:
        queue.put({"ok": False, "error": f"{type(exc).__name__}: {exc}"})


def _predict_with_timeout(space: str, token: str | None, api_name: str, args: list[Any]) -> Any:
    timeout = max(30, int(os.environ.get("MONIA_IMAGE_TIMEOUT_SECONDS", "240")))
    ctx = mp.get_context("fork")
    queue = ctx.Queue()
    process = ctx.Process(target=_predict_child, args=(space, token, api_name, args, queue))
    process.start()
    process.join(timeout)
    if process.is_alive():
        process.terminate()
        process.join(5)
        raise TimeoutError(f"image backend exceeded {timeout}s")
    try:
        message = queue.get_nowait()
    except Empty:
        raise RuntimeError("image backend exited without result")
    if not message.get("ok"):
        raise RuntimeError(str(message.get("error") or "image backend failed"))
    return message.get("result")


def generate_anchor_candidate(request: dict[str, Any], output: Path) -> dict[str, Any]:
    providers = image_provider_chain()
    if not providers:
        return {
            "status": "compute-deferred",
            "output": None,
            "reason": "No image compositor currently available; scene checkpoint preserved for later/local compute.",
            "retryable": True,
            "policy": provider_policy(),
            "approvalRequired": True,
        }
    selected = providers[0]
    space = str(selected["space"])
    api_name = str(selected.get("apiName") or "")
    mode = str(selected.get("mode") or "qwen-compose").lower()

    board = str(request.get("identityBoard") or "")
    if not board or not Path(board).exists():
        raise RuntimeError("Identity board missing")

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(space, token=token, verbose=False)
    if mode in {"multi-reference", "qwen-compose"}:
        refs = list((request.get("references") or {}).values())
        if len(refs) < 2:
            raise RuntimeError("qwen compose mode requires at least two actor references")
        if len(refs) > 3:
            raise RuntimeError("Qwen compose adapter supports at most three reference images")
        local_refs = []
        import requests
        for idx, ref in enumerate(refs):
            if str(ref).startswith(("http://", "https://")):
                response = requests.get(str(ref), timeout=30, headers={"Cache-Control": "no-cache"})
                response.raise_for_status()
                suffix = Path(str(ref).split("?", 1)[0]).suffix or ".png"
                temp = output.parent / f"{output.stem}-ref-{idx}{suffix}"
                temp.write_bytes(response.content)
                local_refs.append(temp)
            else:
        # Generic fallback contract: identity board, positive prompt, negative prompt.
        args = [
            handle_file(board),
            str(request.get("prompt") or ""),
            str(request.get("negative") or ""),
        ]
        result = _predict_with_timeout(space, token, api_name, args)
    _materialize(result, output)
    if output.stat().st_size < 2048:
        raise RuntimeError("Generated anchor candidate is too small")

    manifest = {
        "status": "candidate",
        "output": str(output),
        "provider": space,
        "apiName": api_name,
        "mode": mode,
        "profile": "qwen-image-edit-2511-lightning-compose" if mode in {"multi-reference", "qwen-compose"} else "generic-single-board",
        "providerPolicy": provider_policy(),
        "approvalRequired": True,
        "autoApprove": False,
        "semanticIdentityReviewRequired": True,
    }
    output.with_suffix(".candidate.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest
