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
        candidates.extend(str(value[k]) for k in ("path", "name", "url", "image") if value.get(k))
    elif isinstance(value, (list, tuple)):
        for item in value:
            if isinstance(item, str):
                candidates.append(item)
            elif isinstance(item, dict):
                candidates.extend(str(item[k]) for k in ("path", "name") if item.get(k))
    for candidate in candidates:
        path = Path(candidate)
        if path.exists() and path.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            return
    raise RuntimeError("Image compositor returned no local image result")


def _predict_child(space: str, token: str | None, api_name: str, args: list[Any], queue: Any) -> None:
    try:
        client = Client(space, hf_token=token, verbose=False)
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


def _local_reference(ref: Any, output: Path, idx: int) -> Path:
    text = str(ref)
    if text.startswith(("http://", "https://")):
        import requests
        response = requests.get(text, timeout=30, headers={"Cache-Control": "no-cache"})
        response.raise_for_status()
        suffix = Path(text.split("?", 1)[0]).suffix or ".png"
        path = output.parent / f"{output.stem}-ref-{idx}{suffix}"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(response.content)
        return path
    path = Path(text)
    if not path.exists():
        raise RuntimeError(f"Actor reference missing: {text}")
    return path


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

    token = os.environ.get("HF_TOKEN", "").strip() or None
    attempts: list[dict[str, Any]] = []

    for selected in providers:
        space = str(selected["space"])
        api_name = str(selected.get("apiName") or "")
        mode = str(selected.get("mode") or "qwen-compose").lower()
        try:
            if mode in {"multi-reference", "qwen-compose"}:
                refs = list((request.get("references") or {}).values())
                if len(refs) < 2:
                    raise RuntimeError("qwen compose mode requires at least two actor references")
                refs = refs[:3]
                local_refs = [_local_reference(ref, output, idx) for idx, ref in enumerate(refs)]
                while len(local_refs) < 3:
                    local_refs.append(None)
                images = [handle_file(str(p)) if p else None for p in local_refs]
                call_api = api_name or "/on_compose_generate"
                args = [
                    images[0], images[1], images[2],
                    str(request.get("prompt") or ""),
                    "Fast", 4, 1.0,
                    str(request.get("negative") or " "),
                    42, "", "", 1.0,
                ]
            else:
                board = Path(str(request.get("identityBoard") or ""))
                if not board.exists():
                    raise RuntimeError("Identity board missing")
                call_api = api_name
                args = [
                    handle_file(str(board)),
                    str(request.get("prompt") or ""),
                    str(request.get("negative") or ""),
                ]

            result = _predict_with_timeout(space, token, call_api, args)
            _materialize(result, output)
            if output.stat().st_size < 2048:
                raise RuntimeError("Generated anchor candidate is too small")

            manifest = {
                "status": "candidate",
                "output": str(output),
                "provider": space,
                "apiName": call_api,
                "mode": mode,
                "attempts": attempts + [{"provider": space, "status": "success"}],
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
            attempts.append({"provider": space, "status": "failed", "reason": str(exc)})
            continue

    return {
        "status": "all-providers-unavailable",
        "output": None,
        "attempts": attempts,
        "retryable": True,
        "policy": provider_policy(),
        "approvalRequired": True,
    }
