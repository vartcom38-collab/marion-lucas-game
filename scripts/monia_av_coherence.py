from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np


def _probe_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], text=True).strip()
    return float(out)


def _audio_envelope(audio: Path, sample_hz: int = 25) -> tuple[np.ndarray, float]:
    with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as tmp:
        raw = Path(tmp.name)
    try:
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(audio), "-ac", "1", "-ar", "16000", "-f", "f32le", str(raw),
        ], check=True)
        samples = np.fromfile(raw, dtype=np.float32)
    finally:
        raw.unlink(missing_ok=True)
    if samples.size < 1600:
        raise RuntimeError("Audio too short for coherence analysis")
    window = max(1, 16000 // sample_hz)
    usable = samples[: (samples.size // window) * window]
    chunks = usable.reshape(-1, window)
    rms = np.sqrt(np.mean(np.square(chunks), axis=1) + 1e-12)
    p95 = float(np.percentile(rms, 95)) or 1.0
    return np.clip(rms / p95, 0.0, 1.5), sample_hz


def _mouth_motion(video: Path, sample_hz: int = 25) -> tuple[np.ndarray, float, float]:
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video {video}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    step = max(1, int(round(fps / sample_hz)))
    motions: list[float] = []
    detected = 0
    sampled = 0
    prev_roi: np.ndarray | None = None
    frame_i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_i % step:
            frame_i += 1
            continue
        frame_i += 1
        sampled += 1
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=5, minSize=(80, 80))
        if len(faces):
            x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
            detected += 1
            # Lower-central face: lips/jaw, deliberately excluding most eyes and background.
            y1 = y + int(h * 0.52)
            y2 = min(gray.shape[0], y + int(h * 0.86))
            x1 = x + int(w * 0.20)
            x2 = min(gray.shape[1], x + int(w * 0.80))
            roi = gray[y1:y2, x1:x2]
        else:
            h, w = gray.shape
            roi = gray[int(h * 0.43):int(h * 0.70), int(w * 0.30):int(w * 0.70)]
        if roi.size == 0:
            motions.append(0.0)
            prev_roi = None
            continue
        roi = cv2.resize(roi, (96, 48), interpolation=cv2.INTER_AREA)
        roi = cv2.GaussianBlur(roi, (3, 3), 0)
        if prev_roi is None:
            motions.append(0.0)
        else:
            motions.append(float(np.mean(cv2.absdiff(roi, prev_roi))) / 255.0)
        prev_roi = roi
    cap.release()
    if len(motions) < 20:
        raise RuntimeError("Not enough video frames for coherence analysis")
    face_rate = detected / max(1, sampled)
    duration = total / fps if total > 0 else _probe_duration(video)
    arr = np.asarray(motions, dtype=np.float32)
    p95 = float(np.percentile(arr, 95)) or 1.0
    return np.clip(arr / p95, 0.0, 1.5), face_rate, duration


def _best_corr(a: np.ndarray, v: np.ndarray, hz: float, max_lag_s: float = 0.32) -> tuple[float, float]:
    n = min(len(a), len(v))
    if n < 12:
        return 0.0, 0.0
    a = a[:n]
    v = v[:n]
    max_lag = max(1, int(round(max_lag_s * hz)))
    best = (-1.0, 0)
    for lag in range(-max_lag, max_lag + 1):
        if lag < 0:
            aa, vv = a[-lag:], v[: n + lag]
        elif lag > 0:
            aa, vv = a[: n - lag], v[lag:]
        else:
            aa, vv = a, v
        if len(aa) < 10 or np.std(aa) < 1e-5 or np.std(vv) < 1e-5:
            corr = 0.0
        else:
            corr = float(np.corrcoef(aa, vv)[0, 1])
            if not np.isfinite(corr):
                corr = 0.0
        if corr > best[0]:
            best = (corr, lag)
    return best[0], best[1] / hz


def validate(video: Path, audio: Path) -> dict[str, object]:
    audio_duration = _probe_duration(audio)
    visual, face_rate, video_duration = _mouth_motion(video)
    audio_env, audio_hz = _audio_envelope(audio)

    if video_duration + 0.15 < audio_duration:
        raise RuntimeError(f"Visual performance ends before voice: video={video_duration:.3f}s voice={audio_duration:.3f}s")
    if video_duration - audio_duration > 1.25:
        raise RuntimeError(f"Visual performance has excessive tail: video={video_duration:.3f}s voice={audio_duration:.3f}s")
    if face_rate < 0.45:
        raise RuntimeError(f"Face tracking too weak for speech validation: {face_rate:.2%}")

    hz = min(float(audio_hz), 25.0)
    speech_samples = max(1, int(round(audio_duration * hz)))
    speaking_visual = visual[: min(len(visual), speech_samples)]
    motion_median = float(np.median(speaking_visual))
    motion_p90 = float(np.percentile(speaking_visual, 90))
    if motion_p90 < 0.14:
        raise RuntimeError(f"Visible mouth/jaw movement too weak while Lucas speaks: p90={motion_p90:.3f}")

    corr, lag_s = _best_corr(audio_env, speaking_visual, hz)
    # This is a visual-speech coherence gate, not a phoneme recognizer. It catches grossly unrelated timing.
    if corr < 0.035:
        raise RuntimeError(f"Audio/mouth movement coherence too weak: corr={corr:.3f}")
    if abs(lag_s) > 0.32:
        raise RuntimeError(f"Audio/mouth movement lag too large: lag={lag_s:.3f}s")

    tail_start = int(round(audio_duration * hz))
    tail = visual[tail_start:]
    tail_motion = float(np.percentile(tail, 75)) if tail.size >= 3 else 0.0
    if tail.size >= 3 and tail_motion > max(0.62, motion_median * 1.65):
        raise RuntimeError(f"Mouth/jaw keeps moving too strongly after voice ends: tail={tail_motion:.3f}")

    return {
        "gate": "visual-speech-coherence-v1",
        "passed": True,
        "phoneme_sync_claimed": False,
        "audio_duration": round(audio_duration, 4),
        "video_duration": round(video_duration, 4),
        "face_detection_rate": round(face_rate, 4),
        "mouth_motion_p90": round(motion_p90, 4),
        "audio_visual_correlation": round(corr, 4),
        "best_lag_seconds": round(lag_s, 4),
        "tail_motion_p75": round(tail_motion, 4),
        "note": "Automatic rejection gate for gross speech/mouth timing errors. It does not certify phoneme-perfect lip-sync.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="MonIA automatic audio/visual speech coherence gate")
    parser.add_argument("--video", required=True)
    parser.add_argument("--audio", required=True)
    parser.add_argument("--report")
    args = parser.parse_args()
    report = validate(Path(args.video), Path(args.audio))
    text = json.dumps(report, ensure_ascii=False, indent=2)
    print(text)
    if args.report:
        Path(args.report).write_text(text + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
