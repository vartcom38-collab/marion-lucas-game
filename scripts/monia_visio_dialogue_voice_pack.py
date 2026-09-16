from __future__ import annotations

import os
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np
import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
QWEN_CLONE_API = "/generate_voice_clone"
V16_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-v16-b-smoother-flow-fr-candidate.wav"
)
V16_REFERENCE_TEXT = "Je viens de me poser deux minutes et toi tu fais quoi ?"
VERSION = "v18"

# V18 keeps the exact approved synthetic V16 voice as the reference, but unlike
# rejected V17 it generates the whole visio response set in ONE continuous take.
# The seven replies are separated by deliberately long text breaks, then split at
# the six strongest real silences. This preserves one voice identity/session and
# avoids independently re-generating Lucas seven times.
LINES = [
    ("opening", "Salut, ça va toi ? Qu'est-ce que tu racontes ?"),
    ("calm", "Ça va, journée un peu longue, mais tranquille. Et toi, t'as fait quoi ?"),
    ("warm", "Ah ouais, ça me fait plaisir que tu m'appelles juste pour ça."),
    ("busy", "Je viens de me poser deux minutes. J'allais justement souffler un peu."),
    ("tease", "Je fais pas le malin, enfin, pas tant que ça."),
    ("miss", "Toi aussi, un peu."),
    ("end", "D'accord. On se reparle après."),
]

# Blank lines + repeated ellipsis are only there to encourage clearly longer
# inter-reply pauses than the natural within-reply pauses.
SESSION_TEXT = "\n\n……\n\n".join(text for _, text in LINES)


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def _write_audio_tuple(result, target: Path) -> bool:
    if not (isinstance(result, (list, tuple)) and len(result) >= 1):
        return False
    candidate = result[0] if len(result) == 2 and isinstance(result[1], str) else result
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


def result_path(result) -> Path:
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
    raise RuntimeError(f"Voice provider returned no usable audio file: {type(result).__name__}")


def clone_session(client: Client, reference: Path, target: Path) -> None:
    result = client.predict(
        handle_file(reference),
        V16_REFERENCE_TEXT,
        SESSION_TEXT,
        "French",
        False,
        "1.7B",
        api_name=QWEN_CLONE_API,
    )
    target.unlink(missing_ok=True)
    if _write_audio_tuple(result, target):
        return
    source = result_path(result)
    shutil.copyfile(source, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Qwen V18 continuous session output is too small")


def finish_v16_tone(source: Path, target: Path) -> None:
    # Exact same light tone-shaping chain as the user-approved V16 candidate.
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-ac", "1", "-ar", "24000",
        "-af",
        "highpass=f=55,equalizer=f=190:t=q:w=1:g=0.8,equalizer=f=350:t=q:w=1:g=0.4,equalizer=f=3200:t=q:w=1:g=-0.7,equalizer=f=5200:t=q:w=1:g=-0.4,acompressor=threshold=-21dB:ratio=1.15:attack=18:release=140,loudnorm=I=-18:TP=-2:LRA=9",
        str(target),
    ], check=True, timeout=120)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("V18 finished continuous take is too small")


def read_wav(path: Path) -> tuple[int, np.ndarray]:
    with wave.open(str(path), "rb") as wf:
        if wf.getsampwidth() != 2:
            raise RuntimeError("V18 segmentation expects 16-bit PCM WAV")
        sr = wf.getframerate()
        channels = wf.getnchannels()
        arr = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16)
    if channels > 1:
        arr = arr.reshape(-1, channels).mean(axis=1).astype(np.int16)
    return sr, arr


def strongest_silence_centers(audio: np.ndarray, sr: int, count: int = 6) -> list[int]:
    # Frame RMS silence detector. We intentionally look for the LONGEST/strongest
    # quiet regions, because the generated session has exaggerated breaks only
    # between replies. Natural micro-pauses inside a reply should rank lower.
    frame = max(1, int(sr * 0.02))
    hop = frame
    floats = audio.astype(np.float32) / 32768.0
    rms = []
    for start in range(0, len(floats) - frame + 1, hop):
        chunk = floats[start:start + frame]
        rms.append(float(np.sqrt(np.mean(chunk * chunk) + 1e-12)))
    rms = np.asarray(rms)
    if rms.size < 10:
        raise RuntimeError("V18 take too short for segmentation")

    # Adaptive threshold, capped conservatively so quiet speech is not mistaken
    # for a boundary.
    floor = float(np.percentile(rms, 12))
    threshold = min(0.018, max(0.0045, floor * 2.2))
    quiet = rms < threshold

    regions: list[tuple[int, int]] = []
    start = None
    for i, is_quiet in enumerate(quiet):
        if is_quiet and start is None:
            start = i
        elif not is_quiet and start is not None:
            if i - start >= 7:  # >= 140 ms
                regions.append((start, i))
            start = None
    if start is not None and len(quiet) - start >= 7:
        regions.append((start, len(quiet)))

    duration_frames = len(quiet)
    # Ignore leading/trailing silence and rank by duration first, depth second.
    usable = []
    for a, b in regions:
        center = (a + b) // 2
        if center < duration_frames * 0.04 or center > duration_frames * 0.96:
            continue
        length = b - a
        depth = float(np.mean(rms[a:b]))
        usable.append((length, -depth, center))
    usable.sort(reverse=True)
    chosen = sorted(item[2] for item in usable[:count])
    if len(chosen) != count:
        raise RuntimeError(f"V18 expected {count} inter-reply silences, found {len(chosen)}")
    return [int(c * hop) for c in chosen]


def write_segment(path: Path, sr: int, audio: np.ndarray, start: int, end: int) -> None:
    # Keep a small natural shoulder around each cut; no time stretch, no pitch
    # manipulation and no syllable stitching.
    pad = int(sr * 0.08)
    start = max(0, start - pad)
    end = min(len(audio), end + pad)
    segment = audio[start:end]
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(segment.astype(np.int16).tobytes())
    if path.stat().st_size < 4096:
        raise RuntimeError(f"V18 segment too small: {path.name}")


def main() -> None:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    v16 = engine.WORK_DIR / "lucas-v16-approved-synthetic-reference.wav"
    raw = engine.WORK_DIR / "lucas-visio-dialogue-v18-continuous-raw.wav"
    finished = engine.WORK_DIR / "lucas-visio-dialogue-v18-continuous-finished.wav"
    download(V16_URL, v16)

    qwen = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    clone_session(qwen, v16, raw)
    finish_v16_tone(raw, finished)

    sr, audio = read_wav(finished)
    cuts = strongest_silence_centers(audio, sr, 6)
    boundaries = [0, *cuts, len(audio)]
    durations = []
    for idx, (key, _) in enumerate(LINES):
        target = engine.WORK_DIR / f"lucas-visio-dialogue-{VERSION}-{key}-candidate.wav"
        target.unlink(missing_ok=True)
        write_segment(target, sr, audio, boundaries[idx], boundaries[idx + 1])
        url = engine.publish_candidate(target)
        seconds = (boundaries[idx + 1] - boundaries[idx]) / sr
        durations.append(round(seconds, 2))
        print(f"VISIO_DIALOGUE_VOICE {VERSION} key={key} source=single_v16_synthetic_session url={url} seconds={seconds:.2f}")

    print(f"VISIO_DIALOGUE_VOICE {VERSION} session=single_generation finish=v16_exact segmentation=longest_silences durations={durations}")
    print("VISIO_DIALOGUE_VOICE V17 status=rejected reason=user_reported_wrong_voice_and_robotic_flow")
    # Candidate only. Do not alter visio-test or live runtime until human listening approval.


if __name__ == "__main__":
    main()
