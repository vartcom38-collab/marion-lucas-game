from __future__ import annotations

import argparse
import io
import json
import re
from dataclasses import asdict
from pathlib import Path
from typing import Any

import requests
from PIL import Image

from scripts.monia_video_engine import (
    CharacterProfile,
    SITE,
    WORK_DIR,
    _download_canon,
    _run_ltx,
    _run_wan,
    publish_candidate,
)
import scripts.monia_intro_worker as worker

SCENE_DIR = WORK_DIR / "scenes"
SCENE_DIR.mkdir(parents=True, exist_ok=True)


def _slug(value: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip()).strip("-").lower()
    return clean[:80] or "scene"


def _actor_canon(actor: str) -> str:
    key = actor.strip().lower()
    if key == "lucas":
        return f"{SITE}/resources/monia/canon/lucas/reference.jpg"
    if key == "marion":
        return f"{SITE}/resources/monia/canon/marion/reference.jpg"
    raise ValueError(f"No locked canon reference registered for actor: {actor}")


def _dimensions(fmt: str) -> tuple[int, int, str]:
    if fmt == "9:16":
        return 576, 1024, "9:16 (Portrait)"
    return 960, 544, "16:9 (Landscape)"


def _download_reference(url: str) -> bytes:
    response = requests.get(url, timeout=30, headers={"Cache-Control": "no-cache"})
    response.raise_for_status()
    if len(response.content) < 2048:
        raise RuntimeError("Scene reference is too small")
    return response.content


def _crop_anchor(anchor: dict[str, Any], target: Path, width: int, height: int) -> None:
    if anchor.get("status") != "validated":
        raise RuntimeError("Scene anchor rejected: only validated anchors may guide multi-character generation")
    actors = {str(a).lower() for a in anchor.get("actors") or []}
    if not {"lucas", "marion"}.issubset(actors):
        raise RuntimeError("Scene anchor rejected: validated Marion + Lucas identities are both required")
    url = str(anchor.get("sourceUrl") or "").strip()
    crop = anchor.get("crop") or {}
    if not url:
        raise RuntimeError("Scene anchor rejected: sourceUrl missing")
    raw = _download_reference(url)
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    x = max(0.0, min(1.0, float(crop.get("x", 0))))
    y = max(0.0, min(1.0, float(crop.get("y", 0))))
    w = max(0.01, min(1.0 - x, float(crop.get("width", 1))))
    h = max(0.01, min(1.0 - y, float(crop.get("height", 1))))
    left = round(x * image.width)
    top = round(y * image.height)
    right = max(left + 1, round((x + w) * image.width))
    bottom = max(top + 1, round((y + h) * image.height))
    image = image.crop((left, top, right, bottom))

    target_ratio = width / height
    source_ratio = image.width / image.height
    if source_ratio > target_ratio:
        crop_w = round(image.height * target_ratio)
        left = max(0, (image.width - crop_w) // 2)
        image = image.crop((left, 0, left + crop_w, image.height))
    elif source_ratio < target_ratio:
        crop_h = round(image.width / target_ratio)
        top = max(0, (image.height - crop_h) // 2)
        image = image.crop((0, top, image.width, top + crop_h))
    image.resize((width, height), Image.Resampling.LANCZOS).save(target, "PNG", optimize=True)


def _profile_for_shot(job: dict[str, Any], shot: dict[str, Any], index: int) -> tuple[CharacterProfile, dict[str, Any] | None]:
    width, height, aspect = _dimensions(str(job.get("format") or "16:9"))
    focus_actor = str(shot.get("focusActor") or "Lucas")
    prompt = str(shot.get("prompt") or "").strip()
    if not prompt:
        raise ValueError(f"Shot {shot.get('id') or index + 1} has no generation prompt")

    continuity = str(job.get("continuityKey") or "")
    prompt = " ".join([
        prompt,
        f"MONIA SCENE CONTINUITY={continuity}.",
        "Preserve the exact locked canon identity for every visible canonical character.",
        "Do not copy any reference performer identity; references may guide movement/body language only.",
        "No tattoos or facial scar on Lucas. No identity drift, no face morphing, no generic lookalike.",
        "Candidate output only. Never publish directly to live gameplay.",
    ])

    negative = (
        "identity drift, different face, generic model, lookalike, face morphing, altered jaw, altered eyes, "
        "altered nose, altered mouth, tattoos, body ink, facial scar, deformed hands, extra fingers, duplicated person, "
        "cartoon, illustration, text, subtitles, watermark, UI, still image zoom, jitter"
    )

    duration = max(2, min(8, int(round(float(shot.get("duration") or 3)))))
    output_name = f"scene-{_slug(str(job.get('id') or 'job'))}-{index + 1:02d}-{_slug(str(shot.get('id') or index + 1))}.mp4"

    actors = [str(a) for a in shot.get("actors") or []]
    scene_anchor = shot.get("sceneAnchor") or job.get("sceneAnchor")
    if len(actors) > 1 and not scene_anchor:
        raise RuntimeError(
            "multi-character shot requires a validated MonIA sceneAnchor so Marion and Lucas identities are both anchored"
        )

    canon_url = _actor_canon(focus_actor)
    return CharacterProfile(
        key=f"scene-{_slug(str(job.get('id') or 'job'))}-{index + 1}",
        canon_url=canon_url,
        prompt=prompt,
        negative=negative,
        width=width,
        height=height,
        aspect_ratio=aspect,
        duration=duration,
        output_name=output_name,
    ), scene_anchor


def _generate(profile: CharacterProfile, scene_anchor: dict[str, Any] | None = None) -> tuple[Path, str]:
    source = SCENE_DIR / f"{profile.key}-reference.png"
    target = SCENE_DIR / profile.output_name
    if scene_anchor:
        _crop_anchor(scene_anchor, source, profile.width, profile.height)
    else:
        _download_canon(profile, source)
    target.unlink(missing_ok=True)
    errors: list[str] = []
    try:
        provider = _run_ltx(profile, source, target)
    except Exception as exc:
        errors.append(f"primary: {exc}")
        target.unlink(missing_ok=True)
        try:
            provider = _run_wan(profile, source, target)
        except Exception as fallback_exc:
            errors.append(f"fallback: {fallback_exc}")
            raise RuntimeError("MonIA scene compute unavailable: " + " | ".join(errors)) from fallback_exc
    if not worker.looks_like_video(target):
        raise RuntimeError("Generated scene shot is not a valid video")
    return target, provider


def run_job(job_path: Path, publish: bool) -> dict[str, Any]:
    job = json.loads(job_path.read_text(encoding="utf-8"))
    if job.get("autoPublish") is not False or job.get("approvalRequired") is not True:
        raise RuntimeError("Scene job rejected: approvalRequired=true and autoPublish=false are mandatory")

    result: dict[str, Any] = {
        "jobId": job.get("id"),
        "continuityKey": job.get("continuityKey"),
        "status": "candidate-processing",
        "approvalRequired": True,
        "autoPublish": False,
        "sceneAnchor": job.get("sceneAnchor"),
        "shots": [],
    }

    for index, shot in enumerate(job.get("shots") or []):
        item: dict[str, Any] = {
            "id": shot.get("id") or f"s{index + 1}",
            "focusActor": shot.get("focusActor"),
            "status": "processing",
        }
        try:
            profile, scene_anchor = _profile_for_shot(job, shot, index)
            path, compute = _generate(profile, scene_anchor)
            item.update({
                "status": "candidate-ready",
                "compute": compute,
                "path": str(path),
                "bytes": path.stat().st_size,
                "profile": asdict(profile),
                "sceneAnchorId": scene_anchor.get("id") if scene_anchor else None,
            })
            if publish:
                item["candidateUrl"] = publish_candidate(path)
        except Exception as exc:
            message = str(exc)
            item["status"] = "blocked-reference" if "sceneAnchor" in message else "failed"
            item["error"] = message
        result["shots"].append(item)

    statuses = [s["status"] for s in result["shots"]]
    ready = sum(s == "candidate-ready" for s in statuses)
    blocked = sum(s == "blocked-reference" for s in statuses)
    failed = sum(s == "failed" for s in statuses)
    if ready and not blocked and not failed:
        result["status"] = "candidate-ready"
    elif ready:
        result["status"] = "candidate-partial"
    elif blocked and not failed:
        result["status"] = "blocked-reference"
    else:
        result["status"] = "failed"

    out = SCENE_DIR / f"{_slug(str(job.get('id') or 'job'))}-result.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    result["resultPath"] = str(out)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="MonIA continuity-safe scene shot worker")
    parser.add_argument("--job", type=Path, required=True, help="Path to exported SceneGenerationJob JSON")
    parser.add_argument("--publish-candidates", action="store_true", help="Upload candidate clips to MonIA generated storage; never approves them")
    args = parser.parse_args()
    result = run_job(args.job, args.publish_candidates)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
