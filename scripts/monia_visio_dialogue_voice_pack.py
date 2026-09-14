from __future__ import annotations

import os
import shutil
from pathlib import Path
from gradio_client import Client

import scripts.monia_video_engine as engine

SPACE = "Qwen/Qwen3-TTS"
LANGUAGE = "French"
VOICE_DESCRIPTION = (
    "A native French adult male voice with dark low-mid resonance, naturally masculine and compact rather than exaggeratedly deep. "
    "Dense slightly dry timbre with a light rough edge and very little breathiness. Slow but natural pacing, deliberate micro-pauses, "
    "relaxed connected contemporary French, narrow controlled pitch range, calm self-contained intimate presence, faintly insolent and completely at ease. "
    "No presenter tone, no perfume-ad acting, no forced bass, no whispering, no theatrical growl, no bright question melody, no robotic cadence and no foreign accent."
)
LINES = {
    "opening": "Salut... ça va, toi ? Qu'est-ce que tu racontes ?",
    "calm": "Ça va... journée un peu longue, mais tranquille. Et toi, t'as fait quoi ?",
    "warm": "Ah ouais ? Ça me fait plaisir que tu m'appelles juste pour ça.",
    "busy": "Je viens de me poser deux minutes. J'allais justement souffler un peu.",
    "tease": "Je fais pas le malin. Enfin... pas tant que ça.",
    "miss": "Toi aussi, un peu.",
    "end": "D'accord... on se reparle après."
}

def resolve_audio(result) -> Path:
    items = result if isinstance(result, (list, tuple)) else [result]
    for item in items:
        if isinstance(item, str):
            p = Path(item)
            if p.exists() and p.stat().st_size > 4096:
                return p
        if isinstance(item, dict):
            raw = item.get("path") or item.get("name")
            if raw:
                p = Path(str(raw))
                if p.exists() and p.stat().st_size > 4096:
                    return p
    raise RuntimeError("No usable audio returned")

def main() -> None:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)
    for key, text in LINES.items():
        result = client.predict(text, LANGUAGE, VOICE_DESCRIPTION, api_name="/generate_voice_design")
        source = resolve_audio(result)
        target = engine.WORK_DIR / f"lucas-visio-dialogue-v1-{key}-candidate.wav"
        shutil.copyfile(source, target)
        url = engine.publish_candidate(target)
        print(f"VISIO_DIALOGUE_VOICE key={key} url={url}")

if __name__ == "__main__":
    main()
