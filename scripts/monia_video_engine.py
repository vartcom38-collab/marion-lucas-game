from __future__ import annotations

import argparse
import io
import json
import multiprocessing as mp
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

import requests
from PIL import Image
from gradio_client import Client, handle_file

import scripts.monia_intro_worker as worker

SITE = "https://marion-lucas.marionbolomey.fr"
WORK_DIR = Path(".monia-video")
WORK_DIR.mkdir(exist_ok=True)


@dataclass(frozen=True)
class CharacterProfile:
    key: str
    canon_url: str
    prompt: str
    negative: str


LUCAS = CharacterProfile(
    key="lucas",
    canon_url=f"{SITE}/resources/monia/canon/lucas/reference.jpg",
    prompt=(
        "Photorealistic live-action cinematic shot for the Marion & Lucas desktop game. "
        "The supplied Lucas reference is the absolute identity authority. Do not redesign, "
        "beautify, reinterpret, age-shift or substitute him. Preserve the same facial geometry, "
        "eye spacing, nose, lips, jaw, cheekbones, hairline, dark swept-back hair, light eyes, "
        "short stubble, tanned olive skin, neck tattoos and upper-chest tattoos visible in the canon. "
        "Horizontal 16:9 desktop composition, chest-up framing, Lucas alone, realistic neutral interior, "
        "soft natural daylight. Motion is deliberately minimal to protect identity: natural breathing, "
        "one or two realistic blinks, a tiny eye shift, a very small controlled head inclination and at "
        "most a restrained closed-mouth half-smile. No speaking. Anatomically normal ears exactly as in "
        "the reference: no holes, gauges, piercings or invented ear details."
    ),
    negative=(
        "different man, changed identity, generic male model, beauty filter, altered jaw, altered eyes, "
        "altered nose, altered mouth, altered hairline, altered tattoos, altered ears, ear holes, gauges, "
        "piercings, earrings, deformed ears, woman, second person, extra hands, talking, open mouth, "
        "cartoon, illustration, text, subtitles, title, watermark, UI, jitter, morphing, identity drift"
    ),
)

MARION = CharacterProfile(
    key="marion",
    canon_url=f"{SITE}/resources/monia/canon/marion/reference.jpg",
    prompt=(
        "Photorealistic live-action cinematic shot for the Marion & Lucas desktop game. "
        "The supplied Marion reference is the absolute identity authority. Preserve her exact facial "
        "proportions and recognizable appearance. Horizontal 16:9 desktop composition, natural soft "
        "daylight, restrained cinematic movement, natural breathing and blinking, no identity drift."
    ),
    negative=(
        "different woman, changed identity, generic model face, beauty filter, distorted face, cartoon, "
        "illustration, text, subtitles, title, watermark, UI, jitter, morphing, identity drift"
    ),
)

PROFILES = {p.key: p for p in (LUCAS, MARION)}

# Zero-cost policy: MonIA may only use these free community GPU endpoints.
FREE_WAN_PROVIDERS = tuple(worker.WAN_PROVIDERS)
FREE_LTX_SPACE = worker.LTX_SPACE


def _download_canon(profile: CharacterProfile, target: Path) -> None:
    response = requests.get(profile.canon_url, timeout=30, headers={"Cache-Control": "no-cache"})
    response.raise_for_status()
    if len(response.content) < 2048:
        raise RuntimeError(f"Canon {profile.key} is too small")
    image = Image.open(io.BytesIO(response.content)).convert("RGB")
    image.load()
    # Preserve the actual portrait reference; the video engine itself creates the landscape frame.
    ratio = 768 / 1024
    source_ratio = image.width / image.height
    if source_ratio > ratio:
        width = round(image.height * ratio)
        left = max(0, (image.width - width) // 2)
        image = image.crop((left, 0, left + width, image.height))
    elif source_ratio < ratio:
        height = round(image.width / ratio)
        top = max(0, (image.height - height) // 2)
        image = image.crop((0, top, image.width, top + height))
    image.resize((768, 1024), Image.Resampling.LANCZOS).save(target, "PNG", optimize=True)


def _run_ltx(profile: CharacterProfile, source: Path, target: Path) -> str:
    session = requests.Session()
    session.headers.update(worker.hf_headers())
    with source.open("rb") as fh:
        upload = session.post(
            f"{FREE_LTX_SPACE}/gradio_api/upload",
            files={"files": (source.name, fh, "image/png")},
            timeout=60,
        )
    upload.raise_for_status()
    data = upload.json()
    uploaded = data[0] if isinstance(data, list) else (data.get("files") or [data.get("path")])[0]
    if not uploaded:
        raise RuntimeError("LTX accepted upload but returned no reference path")

    payload = {
        "task_type": "i2v",
        "prompt": profile.prompt,
        "start_image": uploaded,
        "negative_prompt": profile.negative,
        "resolution": "544p",
        "aspect_ratio": "16:9 (Landscape)",
        "width": 960,
        "height": 544,
        "duration": 3,
        "fps": "24fps",
        "seed": -1,
        "zero_gpu_duration": 55,
        "use_spatial_upscaler": False,
        "use_temporal_upscaler": False,
        "async_execution": False,
    }
    submit = session.post(
        f"{FREE_LTX_SPACE}/gradio_api/call/run",
        json={"data": [json.dumps(payload)]},
        timeout=60,
    )
    submit.raise_for_status()
    event_id = submit.json().get("event_id")
    if not event_id:
        raise RuntimeError("LTX GPU job not created")

    response = session.get(
        f"{FREE_LTX_SPACE}/gradio_api/call/run/{quote(str(event_id), safe='')}",
        headers={"Accept": "text/event-stream", **worker.hf_headers()},
        timeout=worker.LTX_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    for block in response.text.split("\n\n"):
        event = None
        data_line = None
        for line in block.splitlines():
            if line.startswith("event:"):
                event = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data_line = line.split(":", 1)[1].strip()
        if event == "error":
            raise RuntimeError(data_line or "LTX rejected generation")
        if event == "complete" and data_line:
            errors: list[str] = []
            for candidate in worker.deep_candidates(json.loads(data_line)):
                try:
                    worker.materialize(candidate, target, FREE_LTX_SPACE, session=session)
                    if worker.looks_like_video(target):
                        return worker.LTX_LABEL
                except Exception as exc:
                    errors.append(str(exc))
            raise RuntimeError("No LTX video recovered: " + " | ".join(errors[-3:]))
    raise RuntimeError("Incomplete LTX response")


def _wan_child(space: str, label: str, profile: CharacterProfile, source: str, target: str, queue) -> None:
    try:
        token = os.environ.get("HF_TOKEN", "").strip() or None
        client = Client(space, token=token, verbose=False)
        result = client.predict(
            profile.prompt,
            handle_file(source),
            1024,
            576,
            33,
            20,
            5,
            -1,
            api_name=worker.WAN_API_NAME,
        )
        errors: list[str] = []
        for candidate in worker.deep_candidates(result):
            try:
                worker.materialize(candidate, Path(target))
                if worker.looks_like_video(Path(target)):
                    queue.put((True, label))
                    return
            except Exception as exc:
                errors.append(str(exc))
        raise RuntimeError("No Wan video recovered: " + " | ".join(errors[-3:]))
    except Exception as exc:
        queue.put((False, str(exc)))


def _run_wan(profile: CharacterProfile, source: Path, target: Path) -> str:
    errors: list[str] = []
    for space, label in FREE_WAN_PROVIDERS:
        ctx = mp.get_context("fork")
        queue = ctx.Queue()
        process = ctx.Process(target=_wan_child, args=(space, label, profile, str(source), str(target), queue))
        process.start()
        process.join(120)
        if process.is_alive():
            process.terminate()
            process.join(5)
            errors.append(f"{label}: timeout")
            continue
        if queue.empty():
            errors.append(f"{label}: no result")
            continue
        ok, detail = queue.get()
        if ok:
            return str(detail)
        errors.append(f"{label}: {detail}")
        target.unlink(missing_ok=True)
    raise RuntimeError(" | ".join(errors))


def generate_candidate(character: str) -> tuple[Path, str]:
    profile = PROFILES[character]
    source = WORK_DIR / f"{character}-canon.png"
    target = WORK_DIR / f"intro-{character}-candidate-desktop.mp4"
    _download_canon(profile, source)
    target.unlink(missing_ok=True)

    errors: list[str] = []
    try:
        provider = _run_ltx(profile, source, target)
    except Exception as exc:
        errors.append(f"{worker.LTX_LABEL}: {exc}")
        target.unlink(missing_ok=True)
        try:
            provider = _run_wan(profile, source, target)
        except Exception as wexc:
            errors.append(str(wexc))
            raise RuntimeError("No free MonIA provider available: " + " | ".join(errors)) from wexc

    if not worker.looks_like_video(target):
        raise RuntimeError("Generated candidate is not a valid video")
    return target, provider


def publish_candidate(path: Path) -> str:
    ftp = worker.ftp_connect()
    try:
        root = worker.remote_root(ftp)
        return worker.upload_file(ftp, root, path, path.name)
    finally:
        try:
            ftp.quit()
        except Exception:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(description="MonIA zero-cost video engine")
    parser.add_argument("--character", choices=sorted(PROFILES), required=True)
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    path, provider = generate_candidate(args.character)
    print(f"MONIA character={args.character} provider={provider} output={path} bytes={path.stat().st_size}")
    if args.publish_candidate:
        url = publish_candidate(path)
        print(f"MONIA candidate={url}")


if __name__ == "__main__":
    main()
