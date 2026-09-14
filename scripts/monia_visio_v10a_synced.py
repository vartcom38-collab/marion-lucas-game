from __future__ import annotations

import argparse
import multiprocessing as mp
import os
import shutil
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

VIDEO_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/visio-lucas-speaking-fr-layout-v7-candidate.mp4?run=34826963016"
VOICE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
OUTPUT_NAME = "visio-lucas-v10a-synced-candidate.mp4"
PROVIDER_TIMEOUT_SECONDS = 180

# MonIA stays the orchestration/policy layer. These are hidden compute adapters
# only; none of them can publish directly to live gameplay. We rotate through
# currently-running Wav2Lip Spaces instead of waiting forever on one queue.
LIPSYNC_SPACES = (
    "guardiancc/gradio-lipsync-wav2lip",
    "smartdigitalnetworks/gradio-lipsync-wav2lip",
    "KingMilkMan/gradio-lipsync-wav2lip",
    "lmh07072000/gradio-lipsync-wav2lip",
    "manavisrani07/gradio-lipsync-wav2lip",
)


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def _resolve_video(result) -> Path:
    items = result if isinstance(result, (list, tuple)) else [result]
    for item in items:
        if isinstance(item, str):
            p = Path(item)
            if p.exists() and p.stat().st_size > 4096:
                return p
        if isinstance(item, dict):
            raw = item.get("path") or item.get("name") or item.get("video")
            if raw:
                p = Path(str(raw))
                if p.exists() and p.stat().st_size > 4096:
                    return p
        if isinstance(item, (list, tuple)):
            for sub in item:
                if isinstance(sub, str):
                    p = Path(sub)
                    if p.exists() and p.stat().st_size > 4096:
                        return p
                if isinstance(sub, dict):
                    raw = sub.get("path") or sub.get("name") or sub.get("video")
                    if raw:
                        p = Path(str(raw))
                        if p.exists() and p.stat().st_size > 4096:
                            return p
    raise RuntimeError(f"Lipsync provider returned no usable video: {type(result).__name__}")


def _provider_worker(space: str, video_s: str, voice_s: str, output_s: str, queue: mp.Queue) -> None:
    video = Path(video_s)
    voice = Path(voice_s)
    output = Path(output_s)
    token = os.environ.get("HF_TOKEN", "").strip() or None
    try:
        client = Client(space, token=token, verbose=False, download_files=True)
        # Forks of this Gradio Space expose either a 9-input callback or the
        # older 8-input wiring where no_smooth disappeared from click inputs.
        attempts = [
            (handle_file(str(video)), handle_file(str(voice)), "wav2lip_gan", False, 1, 0, 20, 0, 0),
            (handle_file(str(video)), handle_file(str(voice)), "wav2lip_gan", 0, 20, 0, 0, 1),
            # Lower-resolution fallback is much faster and is acceptable for a
            # sync test; the original V7 face/eyes remain the visual source.
            (handle_file(str(video)), handle_file(str(voice)), "wav2lip_gan", False, 2, 0, 20, 0, 0),
            (handle_file(str(video)), handle_file(str(voice)), "wav2lip_gan", 0, 20, 0, 0, 2),
        ]
        api_names = ("/generate", "/predict", None)
        last: Exception | None = None
        for args in attempts:
            for api_name in api_names:
                try:
                    if api_name:
                        result = client.predict(*args, api_name=api_name)
                    else:
                        result = client.predict(*args)
                    source = _resolve_video(result)
                    shutil.copyfile(source, output)
                    if engine.worker.looks_like_video(output):
                        queue.put((True, space))
                        return
                except Exception as exc:
                    last = exc
                    output.unlink(missing_ok=True)
        raise RuntimeError(str(last or "no compatible lipsync endpoint"))
    except Exception as exc:
        queue.put((False, f"{space}: {exc}"))


def _try_provider(space: str, video: Path, voice: Path, output: Path) -> tuple[bool, str]:
    queue: mp.Queue = mp.Queue()
    proc = mp.Process(target=_provider_worker, args=(space, str(video), str(voice), str(output), queue), daemon=True)
    proc.start()
    proc.join(PROVIDER_TIMEOUT_SECONDS)
    if proc.is_alive():
        proc.terminate()
        proc.join(10)
        output.unlink(missing_ok=True)
        return False, f"{space}: timed out after {PROVIDER_TIMEOUT_SECONDS}s"
    if not queue.empty():
        ok, message = queue.get()
        return bool(ok), str(message)
    output.unlink(missing_ok=True)
    return False, f"{space}: worker exited without a result (exit={proc.exitcode})"


def run_lipsync(video: Path, voice: Path, output: Path) -> str:
    errors: list[str] = []
    for space in LIPSYNC_SPACES:
        print(f"MONIA_LIPSYNC_TRY provider={space} timeout={PROVIDER_TIMEOUT_SECONDS}s", flush=True)
        ok, message = _try_provider(space, video, voice, output)
        if ok and engine.worker.looks_like_video(output):
            print(f"MONIA_LIPSYNC_OK provider={space}", flush=True)
            return space
        errors.append(message)
        print(f"MONIA_LIPSYNC_SKIP {message}", flush=True)
    raise RuntimeError("No MonIA lipsync compute available: " + " | ".join(errors[-5:]))


def build_synced() -> tuple[Path, str]:
    video = engine.WORK_DIR / "visio-v7-visual-source.mp4"
    voice = engine.WORK_DIR / "lucas-v10a-voice-source.wav"
    output = engine.WORK_DIR / OUTPUT_NAME
    download(VIDEO_URL, video)
    download(VOICE_URL, voice)
    output.unlink(missing_ok=True)
    provider = run_lipsync(video, voice, output)
    if not engine.worker.looks_like_video(output):
        raise RuntimeError("Synced visio output is not a valid video")
    return output, provider


def main() -> None:
    parser = argparse.ArgumentParser(description="Build MonIA Lucas V10-A visio candidate with true audio-driven mouth sync")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    output, provider = build_synced()
    print(f"MONIA_VISIO_V10A_SYNCED compute={provider} output={output} bytes={output.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_VISIO_V10A_SYNCED_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
