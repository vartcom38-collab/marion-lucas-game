from __future__ import annotations

import argparse
import io
import json
import multiprocessing as mp
import os
import shutil
import time
from dataclasses import dataclass
from pathlib import Path
from queue import Empty
from urllib.parse import quote

import requests
from PIL import Image
from gradio_client import Client, handle_file

import scripts.monia_intro_worker as worker

SITE = "https://marion-lucas.marionbolomey.fr"
WORK_DIR = Path(".monia-video")
WORK_DIR.mkdir(exist_ok=True)

RACE_TIMEOUT_SECONDS = int(os.environ.get("MONIA_RACE_TIMEOUT_SECONDS", "420"))
LTX_UPLOAD_TIMEOUT_SECONDS = int(os.environ.get("MONIA_LTX_UPLOAD_TIMEOUT_SECONDS", "120"))
LTX_SUBMIT_TIMEOUT_SECONDS = int(os.environ.get("MONIA_LTX_SUBMIT_TIMEOUT_SECONDS", "120"))
WAN_PROVIDER_TIMEOUT_SECONDS = int(os.environ.get("MONIA_WAN_PROVIDER_TIMEOUT_SECONDS", "360"))


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
        "The supplied Lucas reference is the absolute identity authority. Preserve his facial geometry, "
        "eye spacing, nose, lips, jaw, cheekbones, hairline, thick dark wavy hair, green-hazel eyes, short stubble and tanned olive skin. "
        "Horizontal 16:9 desktop composition, chest-up framing, Lucas alone, realistic neutral interior, soft natural daylight. "
        "Motion is minimal and human: natural breathing, realistic blinks, tiny eye shifts and a restrained head inclination."
    ),
    negative=(
        "different man, changed identity, generic male model, beauty filter, altered jaw, altered eyes, altered nose, altered mouth, altered hairline, "
        "facial scar, deformed ears, second person, extra hands, cartoon, illustration, text, subtitles, title, watermark, UI, jitter, morphing, identity drift"
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
        "Create a brand-new photorealistic live-action front-camera video-call shot of Lucas. "
        "The supplied still is identity reference only. Preserve Lucas exactly. Vertical 9:16, chest-up, complete face visible, believable home interior, natural skin texture, "
        "realistic phone-camera perspective, subtle breathing, irregular blink, tiny glance between screen and lens, restrained head movement and natural micro-expression. "
        "Newly generated scene, never replay or trace a source video."
    ),
    negative=(
        "source-video replay, copied motion, different man, changed identity, beauty filter, altered jaw, altered eyes, altered nose, altered mouth, cropped face, extreme close-up, "
        "second person, extra hands, cartoon, illustration, text, subtitles, watermark, UI overlay, jitter, morphing, identity drift, plastic skin, frozen face, dramatic camera movement"
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
        "Photorealistic live-action cinematic shot for Marion & Lucas. Preserve Marion's exact recognizable appearance. "
        "Horizontal 16:9, natural soft daylight, restrained cinematic movement, natural breathing and blinking, no identity drift."
    ),
    negative=(
        "different woman, changed identity, generic model face, beauty filter, distorted face, cartoon, illustration, text, subtitles, title, watermark, UI, jitter, morphing"
    ),
    width=960,
    height=544,
    aspect_ratio="16:9 (Landscape)",
    duration=3,
    output_name="intro-marion-candidate-desktop.mp4",
)

PROFILES = {p.key: p for p in (LUCAS, LUCAS_VISIO_TEST1, MARION)}
FREE_WAN_PROVIDERS = tuple(worker.WAN_PROVIDERS)
FREE_LTX_SPACE = worker.LTX_SPACE
UPSAMPLER_WAN_SPACE = "Upsampler/wan-2-2-14b-image-to-video"
UPSAMPLER_LTX_SPACE = "Upsampler/ltx-video"


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
            timeout=(30, LTX_UPLOAD_TIMEOUT_SECONDS),
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
        timeout=(30, LTX_SUBMIT_TIMEOUT_SECONDS),
    )
    submit.raise_for_status()
    event_id = submit.json().get("event_id")
    if not event_id:
        raise RuntimeError("MonIA video job not created")

    response = session.get(
        f"{FREE_LTX_SPACE}/gradio_api/call/run/{quote(str(event_id), safe='')}",
        headers={"Accept": "text/event-stream", **worker.hf_headers()},
        timeout=(30, worker.LTX_TIMEOUT_SECONDS),
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


def _run_wan_provider(space: str, label: str, profile: CharacterProfile, source: Path, target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(space, token=token, verbose=False)
    result = client.predict(
        profile.prompt,
        handle_file(str(source)),
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
            worker.materialize(candidate, target)
            if worker.looks_like_video(target):
                return label
        except Exception as exc:
            errors.append(str(exc))
    raise RuntimeError("No generated video recovered: " + " | ".join(errors[-3:]))



def _materialize_gradio_result(result: object, target: Path, label: str) -> str:
    errors: list[str] = []
    for candidate in worker.deep_candidates(result):
        try:
            worker.materialize(candidate, target)
            if worker.looks_like_video(target):
                return label
        except Exception as exc:
            errors.append(str(exc))
    raise RuntimeError("No generated video recovered: " + " | ".join(errors[-3:]))


def _run_upsampler_wan(profile: CharacterProfile, source: Path, target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(UPSAMPLER_WAN_SPACE, token=token, verbose=False)
    duration = max(0.5, min(5.0, float(profile.duration)))
    result = client.predict(
        handle_file(str(source)),
        profile.prompt,
        6,
        profile.negative,
        duration,
        1.0,
        1.0,
        42,
        True,
        None,
        api_name="/generate_video",
    )
    return _materialize_gradio_result(result, target, "Wan 2.2 14B Lightning ZeroGPU")


def _run_upsampler_ltx(profile: CharacterProfile, source: Path, target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(UPSAMPLER_LTX_SPACE, token=token, verbose=False)
    # Keep resolution modest for shared ZeroGPU; preserve the requested aspect ratio.
    height = 544 if profile.width >= profile.height else 768
    width = round(height * profile.width / profile.height)
    width = max(256, (width // 32) * 32)
    height = max(256, (height // 32) * 32)
    result = client.predict(
        handle_file(str(source)),
        profile.prompt,
        float(max(1, min(10, profile.duration))),
        False,
        10,
        True,
        height,
        width,
        api_name="/generate_video",
    )
    return _materialize_gradio_result(result, target, "LTX Video ZeroGPU")

def _provider_child(kind: str, space: str, label: str, profile: CharacterProfile, source: str, target: str, queue) -> None:
    target_path = Path(target)
    try:
        target_path.unlink(missing_ok=True)
        if kind == "upsampler_wan":
            provider = _run_upsampler_wan(profile, Path(source), target_path)
        elif kind == "upsampler_ltx":
            provider = _run_upsampler_ltx(profile, Path(source), target_path)
        elif kind == "ltx":
            provider = _run_ltx(profile, Path(source), target_path)
        else:
            provider = _run_wan_provider(space, label, profile, Path(source), target_path)
        if not worker.looks_like_video(target_path):
            raise RuntimeError("provider returned invalid video")
        queue.put({"ok": True, "label": provider, "target": str(target_path)})
    except Exception as exc:
        queue.put({"ok": False, "label": label, "error": f"{type(exc).__name__}: {exc}"})


def race_compute(profile: CharacterProfile, source: Path, target: Path) -> tuple[str, list[str]]:
    """Run MonIA compute providers concurrently. First valid video wins."""
    ctx = mp.get_context("fork")
    queue = ctx.Queue()
    specs = [
        ("upsampler_wan", UPSAMPLER_WAN_SPACE, "Wan 2.2 14B Lightning ZeroGPU"),
        ("upsampler_ltx", UPSAMPLER_LTX_SPACE, "LTX Video ZeroGPU"),
        ("ltx", FREE_LTX_SPACE, worker.LTX_LABEL),
    ] + [("wan", space, label) for space, label in FREE_WAN_PROVIDERS]
    provider_limit = max(1, int(os.environ.get("MONIA_PROVIDER_LIMIT", str(len(specs)))))
    specs = specs[:provider_limit]
    processes: list[tuple[str, mp.Process, Path]] = []
    errors: list[str] = []

    for index, (kind, space, label) in enumerate(specs):
        temp = WORK_DIR / f"{target.stem}.race-{index}{target.suffix}"
        temp.unlink(missing_ok=True)
        p = ctx.Process(target=_provider_child, args=(kind, space, label, profile, str(source), str(temp), queue))
        p.start()
        processes.append((label, p, temp))
        print(f"MONIA_RACE started provider={label} pid={p.pid}", flush=True)

    deadline = time.monotonic() + RACE_TIMEOUT_SECONDS
    winner: tuple[str, Path] | None = None
    try:
        while time.monotonic() < deadline and any(p.is_alive() for _, p, _ in processes):
            try:
                message = queue.get(timeout=1.0)
            except Empty:
                continue
            if message.get("ok"):
                candidate = Path(str(message["target"]))
                if worker.looks_like_video(candidate):
                    winner = (str(message["label"]), candidate)
                    break
            else:
                errors.append(f"{message.get('label')}: {message.get('error')}")
                print(f"MONIA_RACE failed provider={message.get('label')} error={message.get('error')}", flush=True)

        while winner is None:
            try:
                message = queue.get_nowait()
            except Empty:
                break
            if message.get("ok") and worker.looks_like_video(Path(str(message["target"]))):
                winner = (str(message["label"]), Path(str(message["target"])))
                break
            if not message.get("ok"):
                errors.append(f"{message.get('label')}: {message.get('error')}")
    finally:
        for _, process, _ in processes:
            if process.is_alive():
                process.terminate()
            process.join(5)

    if winner is None:
        for label, _, temp in processes:
            if worker.looks_like_video(temp):
                winner = (label, temp)
                break

    if winner is None:
        for label, _, _ in processes:
            if not any(err.startswith(label + ":") for err in errors):
                errors.append(f"{label}: no valid result before {RACE_TIMEOUT_SECONDS}s deadline")
        raise RuntimeError("No MonIA video compute available: " + " | ".join(errors))

    provider, winner_path = winner
    target.unlink(missing_ok=True)
    shutil.move(str(winner_path), str(target))
    for _, _, temp in processes:
        if temp != winner_path:
            temp.unlink(missing_ok=True)
    print(f"MONIA_RACE winner={provider} bytes={target.stat().st_size}", flush=True)
    return provider, errors


def _run_wan(profile: CharacterProfile, source: Path, target: Path) -> str:
    errors: list[str] = []
    for space, label in FREE_WAN_PROVIDERS:
        temp = WORK_DIR / f"{target.stem}.{label.replace(' ', '-').lower()}{target.suffix}"
        try:
            provider = _run_wan_provider(space, label, profile, source, temp)
            shutil.move(str(temp), str(target))
            return provider
        except Exception as exc:
            errors.append(f"{label}: {exc}")
            temp.unlink(missing_ok=True)
    raise RuntimeError(" | ".join(errors))


def generate_candidate(profile_key: str) -> tuple[Path, str]:
    profile = PROFILES[profile_key]
    source = WORK_DIR / f"{profile_key}-canon.png"
    target = WORK_DIR / profile.output_name
    _download_canon(profile, source)
    target.unlink(missing_ok=True)
    provider, _ = race_compute(profile, source, target)
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
