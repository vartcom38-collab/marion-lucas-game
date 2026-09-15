from __future__ import annotations

import json
import os
import shutil
import wave
from pathlib import Path

import numpy as np
from gradio_client import Client

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
QWEN_DESIGN_API = "/generate_voice_design"
PROFILE_PATH = Path(__file__).resolve().parents[1] / "config" / "lucas-voice-profile.json"
TARGET_TEXT = "Ah ouais... ça me fait plaisir que tu m'appelles juste pour ça."
OUTPUT_NAME = "lucas-visio-dialogue-profile-warm-candidate.wav"


def _write_audio_tuple(result, target: Path) -> bool:
    candidate = result[0] if isinstance(result, (list, tuple)) and len(result) == 2 else result
    if not (isinstance(candidate, (list, tuple)) and len(candidate) == 2):
        return False
    sr, audio = candidate
    if not isinstance(sr, (int, np.integer)):
        return False
    arr = np.asarray(audio)
    if arr.ndim > 1:
        arr = arr.mean(axis=-1)
    if np.issubdtype(arr.dtype, np.floating):
        arr = np.clip(arr, -1.0, 1.0)
        arr = (arr * 32767.0).astype(np.int16)
    elif arr.dtype != np.int16:
        arr = arr.astype(np.int16)
    with wave.open(str(target), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(sr))
        wf.writeframes(arr.tobytes())
    return target.exists() and target.stat().st_size > 4096


def main() -> None:
    profile = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
    target = profile["target_character"]
    measured = profile["measured_reference"]
    description = (
        "Young adult French-speaking man with a naturally low warm baritone register, "
        f"centered roughly around {measured['median_f0_hz']:.0f} to {measured['mean_f0_hz']:.0f} Hz in relaxed speech. "
        "Private phone-call delivery: connected phrases, spontaneous conversational timing, "
        "subtle chest resonance, slight natural roughness, restrained warmth, human pitch variation, "
        "small irregular pauses and soft phrase endings. Diction must stay casual and fluid, not polished. "
        "No robotic cadence, no syllable-by-syllable articulation, no announcer tone, no dramatic acting, "
        "no exaggerated breaths and no word-by-word resets."
    )

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(TARGET_TEXT, "French", description, api_name=QWEN_DESIGN_API)

    target_path = engine.WORK_DIR / OUTPUT_NAME
    target_path.unlink(missing_ok=True)
    if not _write_audio_tuple(result, target_path):
        items = result if isinstance(result, (list, tuple)) else [result]
        source = None
        for item in items:
            if isinstance(item, str):
                p = Path(item)
                if p.exists() and p.stat().st_size > 4096:
                    source = p
                    break
            if isinstance(item, dict):
                raw = item.get("path") or item.get("name")
                if raw:
                    p = Path(str(raw))
                    if p.exists() and p.stat().st_size > 4096:
                        source = p
                        break
        if source is None:
            raise RuntimeError("Qwen profile-guided voice test returned no usable audio")
        shutil.copyfile(source, target_path)

    url = engine.publish_candidate(target_path)
    print(f"LUCAS_PROFILE_VOICE candidate={url}")


if __name__ == "__main__":
    main()
