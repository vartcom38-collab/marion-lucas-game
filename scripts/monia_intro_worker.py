from __future__ import annotations

import ftplib
import io
import json
import multiprocessing as mp
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from PIL import Image
from gradio_client import Client, handle_file

SITE = "https://marion-lucas.marionbolomey.fr"
OUT_DIR = Path(".monia-intro-worker")
OUT_DIR.mkdir(exist_ok=True)
PROVIDER_TIMEOUT_SECONDS = 240

SHOTS = [
    {
        "id": "marion-morning",
        "label": "NÎMES",
        "atlas": Path("public/resources/monia/atlas-marion.webp"),
        "fallback_video": Path("public/resources/marion-nimes.mp4"),
        "output": "intro-marion-generated.mp4",
        "prompt": "Photorealistic live-action cinematic portrait video of Marion, exact same identity and facial proportions as the reference image. Quiet morning at home in Nîmes near a window, soft Mediterranean daylight, simple natural daily clothes. Natural breathing, realistic blinking, subtle eye and head movement, a few restrained body movements, slight hair and clothing motion, elegant short-drama realism, restrained camera movement. No dialogue, no text, no subtitles, no title, no watermark, no UI, no morphing, no identity drift.",
    },
    {
        "id": "lucas-presence",
        "label": "AILLEURS, AU MÊME MOMENT",
        "atlas": Path("public/resources/monia/atlas-lucas.webp"),
        "fallback_video": Path("public/resources/lucas-intro.mp4"),
        "output": "intro-lucas-generated.mp4",
        "prompt": "Photorealistic live-action cinematic portrait video of Lucas, exact same identity and facial proportions as the reference image. Neutral realistic interior in soft morning daylight with no narrative clue. Natural breathing, realistic blinking, subtle eye and head movement, quiet believable body motion, premium short-drama realism, restrained camera movement. No tattoos, no dialogue, no text, no subtitles, no title, no watermark, no UI, no morphing, no identity drift.",
    },
]

WAN_PROVIDERS = [
    ("OpenKing/wan2-video-generation", "Wan 2.2 ZeroGPU A"),
    ("Kpkp21/wan2-video-generation", "Wan 2.2 ZeroGPU C"),
]
WAN_API_NAME = "/generate_video"
LTX_SPACE = "https://rioshiina-ltx-2-5.hf.space"
LTX_LABEL = "LTX 2.5 ZeroGPU B"


def fit_portrait(img: Image.Image, target: Path) -> None:
    img = img.convert("RGB")
    target_ratio = 768 / 1024
    source_ratio = img.width / img.height
    if source_ratio > target_ratio:
        new_w = round(img.height * target_ratio)
        left = max(0, (img.width - new_w) // 2)
        img = img.crop((left, 0, left + new_w, img.height))
    elif source_ratio < target_ratio:
        new_h = round(img.width / target_ratio)
        top = max(0, (img.height - new_h) // 2)
        img = img.crop((0, top, img.width, top + new_h))
    img.resize((768, 1024), Image.Resampling.LANCZOS).save(target, "PNG", optimize=True)


def try_download_atlas(atlas: Path) -> bool:
    if atlas.exists():
        return True
    atlas.parent.mkdir(parents=True, exist_ok=True)
    url = f"{SITE}/resources/monia/{atlas.name}"
    try:
        response = requests.get(url, timeout=30, headers={"Cache-Control": "no-cache"})
        if response.ok and len(response.content) > 1024:
            atlas.write_bytes(response.content)
            print(f"MONIA source atlas downloaded {url}", flush=True)
            return True
        print(f"MONIA source atlas unavailable {url} HTTP {response.status_code}", flush=True)
    except Exception as exc:
        print(f"MONIA source atlas download failed {url}: {exc}", flush=True)
    return False


def crop_first_atlas_cell(atlas: Path, target: Path) -> None:
    img = Image.open(atlas).convert("RGB")
    w, h = img.size
    side, top, bottom, gap = 0.012, 0.13, 0.025, 0.008
    cell_w = (1 - side * 2 - gap * 3) / 4
    cell_h = (1 - top - bottom - gap * 2) / 3
    x = side * w
    y = top * h
    cw = cell_w * w
    ch = cell_h * h
    trim_top = ch * 0.18
    trim_side = cw * 0.025
    box = (
        round(x + trim_side),
        round(y + trim_top),
        round(x + cw - trim_side),
        round(y + ch - ch * 0.015),
    )
    fit_portrait(img.crop(box), target)


def frame_from_existing_video(video: Path, target: Path) -> None:
    frame = OUT_DIR / f"{target.stem}-fallback-frame.png"
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "0.6", "-i", str(video), "-frames:v", "1", str(frame)]
    subprocess.run(command, check=True, timeout=45)
    fit_portrait(Image.open(frame), target)
    print(f"MONIA source fallback from existing true-video {video}", flush=True)


def prepare_source(shot: dict[str, Any], target: Path) -> None:
    atlas: Path = shot["atlas"]
    if try_download_atlas(atlas):
        crop_first_atlas_cell(atlas, target)
        return
    fallback: Path = shot["fallback_video"]
    if not fallback.exists():
        raise FileNotFoundError(f"aucune référence canonique disponible pour {shot['id']}")
    frame_from_existing_video(fallback, target)


def deep_candidate(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        if text.startswith(("http://", "https://")) or text.lower().endswith((".mp4", ".webm", ".mov")):
            return text
        if text[:1] in {"{", "["}:
            try:
                return deep_candidate(json.loads(text))
            except Exception:
                return None
        return None
    if isinstance(value, (list, tuple)):
        for item in value:
            found = deep_candidate(item)
            if found:
                return found
        return None
    if isinstance(value, dict):
        preferred = ("path", "url", "video", "video_path", "video_url", "data", "result", "output", "outputs", "files", "file")
        for key in preferred:
            if key in value:
                found = deep_candidate(value[key])
                if found:
                    return found
        for item in value.values():
            found = deep_candidate(item)
            if found:
                return found
        return None
    for attr in ("path", "url"):
        found = getattr(value, attr, None)
        if isinstance(found, str) and found:
            return found
    return None


def materialize(candidate: str, target: Path, base_space: str | None = None) -> None:
    source = Path(candidate)
    if source.exists():
        shutil.copyfile(source, target)
        return
    url = candidate
    if not url.startswith(("http://", "https://")) and base_space:
        url = f"{base_space}/gradio_api/file={quote(candidate, safe='')}"
    if url.startswith(("http://", "https://")):
        with requests.get(url, stream=True, timeout=90) as response:
            response.raise_for_status()
            with target.open("wb") as fh:
                for chunk in response.iter_content(1024 * 1024):
                    if chunk:
                        fh.write(chunk)
        return
    raise RuntimeError(f"résultat vidéo introuvable: {candidate}")


def _wan_child(space: str, label: str, source: str, prompt: str, target: str, queue: Any) -> None:
    try:
        print(f"MONIA provider={label} connect", flush=True)
        client = Client(space, verbose=False)
        print(f"MONIA provider={label} api={WAN_API_NAME} generate frames=33 steps=20", flush=True)
        result = client.predict(
            prompt,
            handle_file(source),
            576,
            1024,
            33,
            20,
            5,
            -1,
            api_name=WAN_API_NAME,
        )
        candidate = deep_candidate(result)
        if not candidate:
            raise RuntimeError(f"job terminé sans fichier vidéo: {type(result).__name__}")
        materialize(candidate, Path(target))
        if Path(target).stat().st_size < 1024:
            raise RuntimeError("fichier vidéo anormalement petit")
        queue.put((True, ""))
    except Exception as exc:
        queue.put((False, str(exc)))


def run_wan_with_timeout(space: str, label: str, source: Path, prompt: str, target: Path) -> None:
    ctx = mp.get_context("spawn")
    queue = ctx.Queue()
    process = ctx.Process(target=_wan_child, args=(space, label, str(source), prompt, str(target), queue))
    process.start()
    process.join(PROVIDER_TIMEOUT_SECONDS)
    if process.is_alive():
        process.terminate()
        process.join(10)
        raise TimeoutError(f"timeout provider après {PROVIDER_TIMEOUT_SECONDS}s")
    if queue.empty():
        raise RuntimeError(f"provider terminé sans résultat (code {process.exitcode})")
    ok, detail = queue.get()
    if not ok:
        raise RuntimeError(detail)


def run_ltx(source: Path, prompt: str, target: Path) -> None:
    print(f"MONIA provider={LTX_LABEL} upload", flush=True)
    with source.open("rb") as fh:
        upload = requests.post(
            f"{LTX_SPACE}/gradio_api/upload",
            files={"files": (source.name, fh, "image/png")},
            timeout=60,
        )
    upload.raise_for_status()
    uploaded_data = upload.json()
    uploaded_path = uploaded_data[0] if isinstance(uploaded_data, list) else (uploaded_data.get("files") or [uploaded_data.get("path")])[0]
    if not uploaded_path:
        raise RuntimeError("upload LTX accepté mais référence introuvable")

    payload = {
        "task_type": "i2v",
        "prompt": prompt,
        "start_image": uploaded_path,
        "negative_prompt": "cartoon, illustration, static image, low quality, distorted face, deformed face, watermark, text, subtitles, title, label, number, jitter, identity drift",
        "resolution": "544p",
        "aspect_ratio": "9:16 (Portrait)",
        "width": 544,
        "height": 960,
        "duration": 3,
        "fps": "24fps",
        "seed": -1,
        "zero_gpu_duration": 55,
        "use_spatial_upscaler": False,
        "use_temporal_upscaler": False,
        "async_execution": False,
    }
    print(f"MONIA provider={LTX_LABEL} api=/run generate", flush=True)
    submit = requests.post(
        f"{LTX_SPACE}/gradio_api/call/run",
        json={"data": [json.dumps(payload)]},
        timeout=60,
    )
    submit.raise_for_status()
    event_id = submit.json().get("event_id")
    if not event_id:
        raise RuntimeError("LTX joignable mais job GPU non créé")

    result_response = requests.get(
        f"{LTX_SPACE}/gradio_api/call/run/{quote(str(event_id), safe='')}",
        headers={"Accept": "text/event-stream"},
        timeout=PROVIDER_TIMEOUT_SECONDS,
    )
    result_response.raise_for_status()
    text = result_response.text
    for block in text.split("\n\n"):
        event = None
        data = None
        for line in block.splitlines():
            if line.startswith("event:"):
                event = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data = line.split(":", 1)[1].strip()
        if event == "error":
            raise RuntimeError(data or "LTX a rejeté la génération")
        if event == "complete" and data:
            parsed = json.loads(data)
            candidate = deep_candidate(parsed)
            if not candidate:
                preview = data[:1200].replace("\n", " ")
                raise RuntimeError(f"LTX terminé sans URL vidéo; payload={preview}")
            materialize(candidate, target, LTX_SPACE)
            if target.stat().st_size < 1024:
                raise RuntimeError("fichier vidéo LTX anormalement petit")
            return
    raise RuntimeError("réponse LTX incomplète ou file GPU expirée")


def generate(source: Path, prompt: str, target: Path) -> tuple[str, list[str]]:
    attempts: list[str] = []
    for space, label in WAN_PROVIDERS:
        try:
            run_wan_with_timeout(space, label, source, prompt, target)
            print(f"MONIA provider={label} true-video ready bytes={target.stat().st_size}", flush=True)
            return label, attempts
        except Exception as exc:
            msg = f"{label}: {exc}"
            attempts.append(msg)
            print(f"MONIA failed {msg}", flush=True)

    try:
        run_ltx(source, prompt, target)
        print(f"MONIA provider={LTX_LABEL} true-video ready bytes={target.stat().st_size}", flush=True)
        return LTX_LABEL, attempts
    except Exception as exc:
        msg = f"{LTX_LABEL}: {exc}"
        attempts.append(msg)
        print(f"MONIA failed {msg}", flush=True)

    raise RuntimeError(" | ".join(attempts))


def ftp_connect() -> ftplib.FTP_TLS:
    host = os.environ["INFOMANIAK_FTP_HOST"].strip().replace("ftpes://", "").replace("ftps://", "").replace("ftp://", "").rstrip("/")
    ftp = ftplib.FTP_TLS(timeout=45)
    ftp.connect(host, 21)
    ftp.login(os.environ["INFOMANIAK_FTP_USER"].strip(), os.environ["INFOMANIAK_FTP_PASSWORD"].rstrip("\r\n"))
    ftp.prot_p()
    ftp.set_pasv(True)
    return ftp


def read_remote_text(ftp: ftplib.FTP_TLS, path: str) -> str:
    buff = io.BytesIO()
    try:
        ftp.retrbinary(f"RETR {path}", buff.write)
        return buff.getvalue().decode("utf-8", errors="ignore")
    except ftplib.all_errors:
        return ""


def remote_root(ftp: ftplib.FTP_TLS) -> str:
    root_index = read_remote_text(ftp, "/index.html").lower()
    if "marion-nimes.mp4" in root_index or "<title>marion & lucas</title>" in root_index:
        return "/"
    configured = "/sites/marion-lucas.marionbolomey.fr"
    current = ftp.pwd()
    try:
        ftp.cwd(configured)
        ftp.cwd(current)
        return configured
    except ftplib.all_errors:
        try:
            ftp.cwd(current)
        except ftplib.all_errors:
            pass
        return "/"


def ensure_dir(ftp: ftplib.FTP_TLS, path: str) -> None:
    ftp.cwd("/")
    for part in [p for p in path.split("/") if p]:
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def upload_file(ftp: ftplib.FTP_TLS, root: str, local: Path, name: str) -> str:
    directory = (root.rstrip("/") if root != "/" else "") + "/resources/monia/generated"
    ensure_dir(ftp, directory)
    with local.open("rb") as fh:
        ftp.storbinary(f"STOR {name}", fh, blocksize=1024 * 1024)
    return f"/resources/monia/generated/{name}"


def manifest_already_complete() -> bool:
    try:
        response = requests.get(f"{SITE}/resources/monia/generated/intro-manifest.json", timeout=15, headers={"Cache-Control": "no-cache"})
        if not response.ok:
            return False
        data = response.json()
        shots = data.get("shots", []) if isinstance(data, dict) else []
        return {s.get("id") for s in shots if isinstance(s, dict) and s.get("videoUrl")} >= {"marion-morning", "lucas-presence"}
    except Exception:
        return False


def main() -> int:
    force = os.environ.get("MONIA_FORCE", "").lower() in {"1", "true", "yes"}
    if manifest_already_complete() and not force:
        print("MONIA intro manifest already complete; nothing to generate.")
        return 0

    generated: list[dict[str, Any]] = []
    for shot in SHOTS:
        source = OUT_DIR / f"{shot['id']}.png"
        target = OUT_DIR / shot["output"]
        prepare_source(shot, source)
        provider, attempts = generate(source, shot["prompt"], target)
        generated.append({"id": shot["id"], "label": shot["label"], "file": target, "provider": provider, "attempts": attempts})

    ftp = ftp_connect()
    try:
        root = remote_root(ftp)
        manifest_shots = []
        for item in generated:
            url = upload_file(ftp, root, item["file"], item["file"].name)
            manifest_shots.append({"id": item["id"], "label": item["label"], "videoUrl": url, "provider": item["provider"]})
        manifest = {"version": 1, "generatedBy": "MonIA GitHub worker", "shots": manifest_shots}
        manifest_path = OUT_DIR / "intro-manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        upload_file(ftp, root, manifest_path, "intro-manifest.json")
    finally:
        ftp.quit()

    print(json.dumps({"ok": True, "shots": [{"id": x["id"], "provider": x["provider"]} for x in generated]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"MONIA_WORKER_ERROR: {exc}", file=sys.stderr, flush=True)
        raise
