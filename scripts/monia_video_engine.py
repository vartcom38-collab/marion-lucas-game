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
    width: int
    height: int
    aspect_ratio: str
    duration: int
    output_name: str


LUCAS = CharacterProfile(
    key="lucas",
    canon_url=f"{SITE}/resources/monia/canon/lucas/reference.jpg",
    prompt=(
        "Photorealistic live-action cinematic shot for the Marion & Lucas desktop game. "
        "The supplied Lucas reference is the absolute identity authority. Do not redesign, "
        "beautify, reinterpret, age-shift or substitute him. Preserve the same facial geometry, "
        "eye spacing, nose, lips, jaw, cheekbones, hairline, thick dark wavy hair with natural strands, "
        "intense brown-hazel eyes, short stubble and tanned olive skin. Lucas has no tattoos and no facial scar. "
        "Horizontal 16:9 desktop composition, chest-up framing, Lucas alone, realistic neutral interior, "
        "soft natural daylight. Motion is deliberately minimal to protect identity: natural breathing, "
        "one or two realistic blinks, a tiny eye shift, a very small controlled head inclination and at "
        "most a restrained closed-mouth half-smile. No speaking. Anatomically normal ears exactly as in "
        "the reference: no holes, gauges, piercings or invented ear details."
    ),
    negative=(
        "different man, changed identity, generic male model, beauty filter, altered jaw, altered eyes, "
        "altered nose, altered mouth, altered hairline, tattoos, body ink, facial scar, nose scar, altered ears, "
        "ear holes, gauges, piercings, earrings, deformed ears, woman, second person, extra hands, talking, open mouth, "
        "cartoon, illustration, text, subtitles, title, watermark, UI, jitter, morphing, identity drift"
    ),
    width=960,
    height=544,
    aspect_ratio="16:9 (Landscape)",
    duration=3,
    output_name="intro-lucas-candidate-desktop.mp4",
)

LUCAS_VISIO_TEST1 = CharacterProfile(
    key="lucas-visio-test1",
    canon_url=f"{SITE}/resources/monia/canon/lucas/reference.jpg",
    prompt=(
        "Create a brand-new photorealistic live-action video-call shot of Lucas for Marion & Lucas. "
        "The supplied still image is identity reference only, never a motion source and never a clip to copy. "
        "Invent a new moment and new movement while preserving Lucas exactly: same facial geometry, eye spacing, "
        "nose, lips, jaw, cheekbones, hairline, dark wavy hair with a few natural strands, brown-hazel eyes, "
        "short stubble and olive skin. Lucas has absolutely no tattoos and no facial scar. "
        "Vertical 9:16 phone-video-call composition, chest-up framing with his complete face clearly visible, "
        "not an extreme close-up and never only a fragment of his face. Lucas is alone in a believable warm home "
        "interior different from the reference background, wearing a plain black shirt with a clean visible neck. "
        "He feels like a real person currently on a live video call: subtle breathing, one natural irregular blink, "
        "a tiny glance briefly away from the screen and back toward the camera, then a very small relaxed head movement "
        "and restrained closed-mouth micro-expression. He does not speak in this identity test. The camera is stable "
        "like a phone resting naturally. Natural skin texture, realistic eyes, realistic micro-movements, soft warm light. "
        "This must be a newly generated scene, not a replay, trace, crop, reenactment or near-copy of any source video."
    ),
    negative=(
        "source-video replay, copied motion, identical source framing, identical source background, different man, "
        "changed identity, generic male model, beauty filter, altered jaw, altered eyes, altered nose, altered mouth, "
        "altered hairline, tattoo, tattoos, body ink, facial scar, nose scar, cropped face, partial face, extreme close-up, "
        "ear holes, gauges, piercings, earrings, deformed ears, second person, extra person, extra hands, talking, open mouth, "
        "lip movement, cartoon, illustration, text, subtitles, title, watermark, UI overlay, jitter, morphing, identity drift, "
        "plastic skin, frozen face, looped gesture, dramatic camera movement"
    ),
    width=576,
    height=1024,
    aspect_ratio="9:16 (Portrait)",
    duration=4,
    output_name="visio-lucas-test1-candidate.mp4",
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
    width=960,
    height=544,
    aspect_ratio="16:9 (Landscape)",
    duration=3,
    output_name="intro-marion-candidate-desktop.mp4",
)

PROFILES = {p.key: p for p in (LUCAS, LUCAS_VISIO_TEST1, MARION)}

# MonIA owns the orchestration and candidate/approval policy. The compute adapter stays hidden behind this engine.
FREE_WAN_PROVIDERS = tuple(worker.WAN_PROVIDERS)
FREE_LTX_SPACE = worker.LTX_SPACE


def _download_canon(profile: CharacterProfile, target: Path) -> None:
    response = requests.get(profile.canon_url, timeout=30, headers={"Cache-Control": "no-cache"})
    response.raise_for_status()
    if len(response.content) < 2048:
        raise RuntimeError(f"Canon {profile.key} is too small")
    image = Image.open(io.BytesIO(response.content)).convert("RGB")
    image.load()
    ratio = profile.width / profile.height
    source_ratio = image.width / image.height
    if source_ratio > ratio:
        width = round(image.height * ratio)
        left = max(0, (image.width - width) // 2)
        image = image.crop((left, 0, left + width, image.height))
    elif source_ratio < ratio:
        height = round(image.width / ratio)
        top = max(0, (image.height - height) // 2)
        image = image.crop((0, top, image.width, top + height))
    image.resize((profile.width, profile.height), Image.Resampling.LANCZOS).save(target, "PNG", optimize=True)


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
        raise RuntimeError("video compute accepted upload but returned no reference path")

    payload = {
        "task_type": "i2v",
        "prompt": profile.prompt,
        "start_image": uploaded,
        "negative_prompt": profile.negative,
        "resolution": "544p",
        "aspect_ratio": profile.aspect_ratio,
        "width": profile.width,
        "height": profile.height,
        "duration": profile.duration,
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
        raise RuntimeError("MonIA video job not created")

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
            raise RuntimeError(data_line or "MonIA video compute rejected generation")
        if event == "complete" and data_line:
            errors: list[str] = []
            for candidate in worker.deep_candidates(json.loads(data_line)):
                try:
                    worker.materialize(candidate, target, FREE_LTX_SPACE, session=session)
                    if worker.looks_like_video(target):
                        return worker.LTX_LABEL
                except Exception as exc:
                    errors.append(str(exc))
            raise RuntimeError("No generated video recovered: " + " | ".join(errors[-3:]))
    raise RuntimeError("Incomplete video compute response")


def _wan_child(space: str, label: str, profile: CharacterProfile, source: str, target: str, queue) -> None:
    try:
        token = os.environ.get("HF_TOKEN", "").strip() or None
        client = Client(space, token=token, verbose=False)
        result = client.predict(
            profile.prompt,
            handle_file(source),
            profile.width,
            profile.height,
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
        raise RuntimeError("No generated video recovered: " + " | ".join(errors[-3:]))
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


def generate_candidate(profile_key: str) -> tuple[Path, str]:
    profile = PROFILES[profile_key]
    source = WORK_DIR / f"{profile_key}-canon.png"
    target = WORK_DIR / profile.output_name
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
        except Exception as wexc:
            errors.append(str(wexc))
            raise RuntimeError("No MonIA video compute available: " + " | ".join(errors)) from wexc

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
    parser = argparse.ArgumentParser(description="MonIA video engine")
    parser.add_argument("--character", choices=sorted(PROFILES), required=True)
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    path, provider = generate_candidate(args.character)
    print(f"MONIA profile={args.character} compute={provider} output={path} bytes={path.stat().st_size}")
    if args.publish_candidate:
        url = publish_candidate(path)
        print(f"MONIA candidate={url}")


if __name__ == "__main__":
    main()
