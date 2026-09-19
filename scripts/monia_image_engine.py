from __future__ import annotations

import json
import multiprocessing as mp
import os
import shutil
from pathlib import Path
from queue import Empty
from typing import Any

from gradio_client import Client, handle_file

from scripts.monia_image_providers import image_provider_chain, provider_policy


def _materialize(value: Any, target: Path) -> None:
    candidates: list[str] = []
    if isinstance(value, str):
        candidates.append(value)
    elif isinstance(value, dict):
        for key in ("path", "name", "url", "image"):
            if value.get(key):
                candidates.append(str(value[key]))
    elif isinstance(value, (list, tuple)):
        for item in value:
            if isinstance(item, str):
                candidates.append(item)
            elif isinstance(item, dict):
                for key in ("path", "name"):
                    if item.get(key):
                        candidates.append(str(item[key]))
    for candidate in candidates:
        path = Path(candidate)
        if path.exists() and path.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            return
    raise RuntimeError("Image compositor returned no local image result")


def _predict_child(space: str, token: str | None, api_name: str, args: list[Any], queue: Any) -> None:
    try:
        client = Client(space, token=token, verbose=False)
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
    except Empty as exc:
        raise RuntimeError("image backend exited without result") from exc
    if not message.get("ok"):
        raise RuntimeError(str(message.get("error") or "image backend failed"))
    return message.get("result")


def _local_reference(ref: str, output: Path, index: int) -> Path:
    if ref.startswith(("http://", "https://")):
        import requests
        response = requests.get(ref, timeout=30, headers={"Cache-Control": "no-cache"})
        response.raise_for_status()
        suffix = Path(ref.split("?", 1)[0]).suffix or ".png"
        target = output.parent / f"{output.stem}-ref-{index}{suffix}"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(response.content)
        return target
    path = Path(ref)
    if not path.exists():
        raise RuntimeError(f"Actor reference missing: {ref}")
    return path


def _run_provider(provider: dict[str, Any], request: dict[str, Any], output: Path) -> dict[str, Any]:
    space = str(provider.get("space") or "")
    api_name = str(provider.get("apiName") or "")
    mode = str(provider.get("mode") or "qwen-compose").lower()
    token = os.environ.get("HF_TOKEN", "").strip() or None

    board = str(request.get("identityBoard") or "")
    if not board or not Path(board).exists():
        raise RuntimeError("Identity board missing")

    if mode in {"multi-reference", "qwen-compose"}:
        refs = [str(x) for x in (request.get("references") or {}).values() if x]
        if len(refs) < 2:
            raise RuntimeError("qwen compose mode requires at least two actor references")
        if len(refs) > 3:
            refs = refs[:3]
        local_refs = [_local_reference(ref, output, idx) for idx, ref in enumerate(refs)]
        while len(local_refs) < 3:
            local_refs.append(None)
        images = [handle_file(str(path)) if path else None for path in local_refs]
        call_api = api_name or "/on_compose_generate"
        args = [
            images[0], images[1], images[2],
            str(request.get("prompt") or ""),
            "Fast", 4, 1.0,
            str(request.get("negative") or " "),
            42, "", "", 1.0,
        ]
    else:
        call_api = api_name
        args = [
            handle_file(board),
            str(request.get("prompt") or ""),
            str(request.get("negative") or ""),
        ]

    result = _predict_with_timeout(space, token, call_api, args)
    _materialize(result, output)
    if output.stat().st_size < 2048:
        raise RuntimeError("Generated anchor candidate is too small")
    return {"provider": space, "apiName": call_api, "mode": mode}


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

    attempts: list[dict[str, Any]] = []
    for provider in providers:
        try:
            used = _run_provider(provider, request, output)
            manifest = {
                "status": "candidate",
                "output": str(output),
                **used,
                "attempts": attempts,
                "profile": "qwen-image-edit-2511-lightning-compose" if used["mode"] in {"multi-reference", "qwen-compose"} else "generic-single-board",
                "providerPolicy": provider_policy(),
                "approvalRequired": True,
                "autoApprove": False,
                "semanticIdentityReviewRequired": True,
            }
            output.with_suffix(".candidate.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            return manifest
        except Exception as exc:
            attempts.append({
                "provider": str(provider.get("space") or ""),
                "mode": str(provider.get("mode") or ""),
                "reason": f"{type(exc).__name__}: {exc}",
            })

    return {
        "status": "all-providers-unavailable",
        "output": None,
        "attempts": attempts,
        "retryable": True,
        "policy": provider_policy(),
        "approvalRequired": True,
    }
