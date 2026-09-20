from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

from gradio_client import Client

import scripts.monia_video_engine as engine

SPACE = "Qwen/Qwen3-TTS"
LANGUAGE = "French"
VOICE_ID = "lucas-v16-approved-direct-design"

BASE_DESCRIPTION = (
    "Generate a distinct synthetic native French young adult male voice using the locked Lucas V16 vocal direction: "
    "naturally low, warm, very close and intimate, compact timbre, soft slightly husky texture, smooth low-mid resonance, "
    "relaxed consonants, natural imperfect edges and very little brightness. Keep calm, affectionate, effortless private-conversation energy. "
    "Preserve one connected French thought group with natural linking, tiny irregular micro-pauses only when linguistically needed, "
    "restrained natural pitch movement, soft attacks and a relaxed slightly low falling ending. "
    "Do not reinterpret the voice. Do not make it deeper, brighter, cleaner, more polished, theatrical, announcer-like or studio-perfect. "
    "No forced bass, no whisper unless the scene explicitly requires a whisper, no metallic brightness, no synthetic sheen, "
    "no syllabic cadence, no word-by-word rhythm, no choppy pauses and no robotic timing."
)

EMOTION_DIRECTIONS = {
    "neutral": "Keep the delivery relaxed, attentive and conversational.",
    "warm": "Add restrained affectionate warmth and a faint smile in the voice without becoming sweet or theatrical.",
    "amused": "Add a small genuine amused lift and human irregularity, never a performed laugh.",
    "tender": "Make it softer and closer, protective and sincere, while preserving the same core voice identity.",
    "concerned": "Use slightly firmer focus and concern, still controlled and intimate rather than dramatic.",
    "tired": "Allow subtle believable fatigue in breath and energy, but keep articulation connected and the voice recognizable.",
    "whisper": "Use a close low whisper-like intimacy only for this scene, preserving intelligibility and the same vocal identity; avoid breathy ASMR exaggeration.",
}


def _slug(value: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return clean[:48] or "line"


def _resolve_audio(result) -> Path:
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
    raise RuntimeError(f"Voice renderer returned no usable audio: {type(result).__name__}")


def finish_v16_tone(source: Path, target: Path) -> None:
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-ac", "1", "-ar", "24000",
        "-af",
        "highpass=f=55,equalizer=f=190:t=q:w=1:g=0.8,equalizer=f=350:t=q:w=1:g=0.4,equalizer=f=3200:t=q:w=1:g=-0.7,equalizer=f=5200:t=q:w=1:g=-0.4,acompressor=threshold=-21dB:ratio=1.15:attack=18:release=140,loudnorm=I=-18:TP=-2:LRA=9",
        str(target),
    ], check=True, timeout=120)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError(f"Lucas V16 runtime render too small: {target}")


def duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], text=True).strip()
    return float(out)


def render_line(text: str, emotion: str = "neutral", request_id: str = "", publish_candidate: bool = False) -> dict:
    text = " ".join(text.strip().split())
    if not text:
        raise RuntimeError("Lucas runtime voice requires non-empty text")
    if len(text) > 600:
        raise RuntimeError("Lucas runtime voice line is too long; split long scenes into natural dialogue beats")
    if emotion not in EMOTION_DIRECTIONS:
        emotion = "neutral"

    voice_cache_key = hashlib.sha256(f"{VOICE_ID}|{LANGUAGE}|{text}|{emotion}".encode("utf-8")).hexdigest()
    voice_cache_dir = Path(os.environ.get("MONIA_VOICE_CACHE_DIR", ".monia-video/voice-cache"))
    voice_cache_dir.mkdir(parents=True, exist_ok=True)
    cached_wav = voice_cache_dir / f"{voice_cache_key}.wav"
    cached_manifest = voice_cache_dir / f"{voice_cache_key}.json"
    if cached_wav.exists() and cached_wav.stat().st_size >= 4096 and cached_manifest.exists():
        try:
            cached = json.loads(cached_manifest.read_text(encoding="utf-8"))
            if cached.get("voice_id") == VOICE_ID and cached.get("text") == text and cached.get("emotion") == emotion:
                cached["output"] = str(cached_wav)
                cached["source_mode"] = "persistent-approved-voice-cache"
                return cached
        except Exception:
            pass
    request_id = request_id.strip() or hashlib.sha256(f"{text}|{emotion}".encode("utf-8")).hexdigest()[:12]
    stem = f"lucas-v16-runtime-{_slug(request_id)}"
    raw = engine.WORK_DIR / f"{stem}-raw.wav"
    target = engine.WORK_DIR / f"{stem}.wav"
    manifest_path = engine.WORK_DIR / f"{stem}.json"
    description = f"{BASE_DESCRIPTION} Scene performance direction: {EMOTION_DIRECTIONS[emotion]}"
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, hf_token=token, verbose=False, download_files=True)
    result = client.predict(text, LANGUAGE, description, api_name="/generate_voice_design")
    generated = _resolve_audio(result)
    shutil.copyfile(generated, raw)
    target.unlink(missing_ok=True)
    finish_v16_tone(raw, target)
    raw.unlink(missing_ok=True)
    seconds = duration(target)
    manifest = {
        "voice_id": VOICE_ID, "request_id": request_id, "text": text, "emotion": emotion,
        "language": "fr-FR", "output": str(target), "duration": round(seconds, 3),
        "source_mode": "direct-synthetic-voice-design", "uses_real_person_voice_clone": False,
        "uses_v17_or_v18": False, "speed_or_pitch_warp": False, "canonical_reference_promotion": False,
    }
    if publish_candidate:
        manifest["candidate_url"] = engine.publish_candidate(target)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.copy2(target, cached_wav)
    cache_manifest = dict(manifest)
    cache_manifest["output"] = str(cached_wav)
    cache_manifest["cache_key"] = voice_cache_key
    cached_manifest.write_text(json.dumps(cache_manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Render arbitrary MonIA Lucas dialogue with the approved V16 direct synthetic voice direction")
    parser.add_argument("--text", required=True)
    parser.add_argument("--emotion", choices=sorted(EMOTION_DIRECTIONS), default="neutral")
    parser.add_argument("--request-id", default="")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    manifest = render_line(args.text, args.emotion, args.request_id, args.publish_candidate)
    print("MONIA_LUCAS_V16_RUNTIME " + json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
