from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

import scripts.monia_intro_worker as worker

SITE = worker.SITE
OUT = Path(".monia-dominic-microshots")
OUT.mkdir(exist_ok=True)
SHOTS: list[dict[str, Any]] = [
    {
        "id": "dominic-seated-thought",
        "label": "Dominic assis",
        "referencePath": "private-reference-bootstrap/dominic/dominic-seated-ref.jpg",
        "prompt": (
            "Photorealistic live-action cinematic medium shot of Dominic, strict identity preservation, exact same man as the canonical reference. "
            "Dominic is seated alone in a refined realistic interior, white open-collar shirt, black trousers, canonical neck and chest tattoos visible. "
            "He looks slightly downward for a moment, breathes naturally, then raises his eyes just a little toward something off-screen. "
            "One natural blink, tiny shoulder movement, restrained tension, neutral mouth, no smile. "
            "Frame from around waist to above head, comfortable headroom, external stable camera, warm natural daylight, premium short-drama realism. "
            "No extreme close-up, no zoom, no morphing, no identity drift, no eye drift, no jaw drift, no beard drift, no tattoo drift, no text, no subtitles, no UI."
        ),
    },
    {
        "id": "dominic-window",
        "label": "Dominic fenêtre",
        "referencePath": "private-reference-bootstrap/dominic/dominic-window-ref.jpg",
        "prompt": (
            "Photorealistic live-action cinematic waist-up shot of Dominic, strict identity preservation, exact same man as the canonical reference. "
            "Dominic stands alone near a large window in a refined realistic interior, white open-collar shirt, black trousers, canonical tattoos visible. "
            "Soft golden side light. He looks out of the window, breathes naturally, blinks once, then makes a very small head turn back toward the room under 10 degrees. "
            "Calm controlled masculine presence, neutral mouth, subtle body weight shift only. "
            "Stable external camera, comfortable headroom, premium short-drama realism. "
            "No extreme close-up, no zoom, no morphing, no identity drift, no eye drift, no jaw drift, no beard drift, no tattoo drift, no text, no subtitles, no UI."
        ),
    },
    {
        "id": "dominic-offscreen-reaction",
        "label": "Dominic réaction",
        "referencePath": "private-reference-bootstrap/dominic/dominic-reaction-ref.jpg",
        "prompt": (
            "Photorealistic live-action cinematic medium-close shot of Dominic, strict identity preservation, exact same man as the canonical reference. "
            "Dominic is alone in a refined warm interior, white open-collar shirt, canonical neck and chest tattoos visible. "
            "At first he looks slightly to one side, then reacts to a quiet off-screen sound with only a tiny eye shift and subtle brow tension, followed by a small head turn under 8 degrees. "
            "One natural blink, subtle breathing, neutral mouth, no smile, no exaggerated expression. "
            "Frame from upper chest to head with comfortable headroom, external stable camera, warm realistic light, premium short-drama realism. "
            "No extreme close-up, no zoom, no morphing, no identity drift, no eye drift, no jaw drift, no beard drift, no tattoo drift, no text, no subtitles, no UI."
        ),
    },
]

def prepare_reference(shot: dict[str, Any]) -> Path:
    target = OUT / f"{shot['id']}-reference.png"
    source = Path(shot["referencePath"])
    if not source.exists():
        raise FileNotFoundError(f"missing scene reference: {source}")
    img = Image.open(source)
    img.load()
    worker.fit_portrait(img, target)
    print(f"MONIA_SCENE_REFERENCE {shot['id']} {source}", flush=True)
    return target

def upload_nested(ftp, root: str, local: Path, remote_name: str) -> str:
    directory = (root.rstrip("/") if root != "/" else "") + "/resources/monia/generated/dominic-microshots"
    worker.ensure_dir(ftp, directory)
    with local.open("rb") as fh:
        ftp.storbinary(f"STOR {remote_name}", fh, blocksize=1024 * 1024)
    return f"/resources/monia/generated/dominic-microshots/{remote_name}"

def main() -> int:
    generated = []
    for shot in SHOTS:
        source = prepare_reference(shot)
        target = OUT / f"{shot['id']}.mp4"
        provider, attempts = worker.generate(source, shot["prompt"], target)
        qa = worker.validate_video_candidate(target, shot["id"])
        generated.append({
            "id": shot["id"],
            "label": shot["label"],
            "file": target,
            "provider": provider,
            "attempts": attempts,
            "qa": qa,
        })

    ftp = worker.ftp_connect()
    try:
        root = worker.remote_root(ftp)
        manifest_shots = []
        for item in generated:
            url = upload_nested(ftp, root, item["file"], item["file"].name)
            manifest_shots.append({
                "id": item["id"],
                "label": item["label"],
                "videoUrl": url,
                "provider": item["provider"],
                "candidateOnly": True,
                "humanApprovalRequired": True,
                "technicalQa": item["qa"],
            })
        manifest = {
            "version": 1,
            "generatedBy": "MonIA Dominic microshot worker",
            "candidateOnly": True,
            "narrativeAuthority": False,
            "shots": manifest_shots,
        }
        manifest_path = OUT / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        upload_nested(ftp, root, manifest_path, "manifest.json")
    finally:
        ftp.quit()

    print(json.dumps({"ok": True, "shots": [{"id": x["id"], "provider": x["provider"]} for x in generated]}, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
