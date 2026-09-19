from __future__ import annotations

import argparse
import json
import wave
from pathlib import Path
from typing import Any


def _wav_duration_ms(path: Path) -> int:
    with wave.open(str(path), "rb") as wav:
        frames = wav.getnframes()
        rate = wav.getframerate()
        if rate <= 0:
            raise RuntimeError(f"Invalid WAV sample rate: {path}")
        return max(1, round(frames * 1000 / rate))


def build_av_plan(scene: dict[str, Any], voice_dir: Path | None = None) -> dict[str, Any]:
    shots = scene.get("shots") or []
    performance = scene.get("performance") or {}
    dialogue = performance.get("dialogue") or []
    cursor_ms = 0
    utterances = []
    for beat in dialogue:
        before = max(0, int(beat.get("pauseBeforeMs") or 0))
        after = max(0, int(beat.get("pauseAfterMs") or 0))
        cursor_ms += before
        words = max(1, len(str(beat.get("text") or "").split()))
        estimated_ms = max(650, int(words / 2.45 * 1000))
        audio_path = None
        measured_ms = None
        if voice_dir is not None:
            candidate = voice_dir / f"line-{int(beat.get('index') or len(utterances) + 1):03d}.wav"
            if candidate.exists():
                audio_path = str(candidate)
                measured_ms = _wav_duration_ms(candidate)
        duration_ms = measured_ms or estimated_ms
        start = cursor_ms
        end = start + duration_ms
        utterances.append({
            "index": beat.get("index"),
            "speaker": beat.get("speaker"),
            "text": beat.get("text"),
            "startMs": start,
            "endMs": end,
            "durationMs": duration_ms,
            "timingSource": "measured-wav" if measured_ms else "word-estimate",
            "audioPath": audio_path,
            "allowOverlap": bool(beat.get("allowOverlap", False)),
            "listeners": beat.get("listeners") or [],
            "emotion": beat.get("emotion"),
            "delivery": beat.get("delivery"),
            "lipSyncRequired": True,
        })
        cursor_ms = end if beat.get("allowOverlap") else end + after

    shot_cursor = 0
    timeline_shots = []
    for shot in shots:
        duration_ms = int(float(shot.get("duration") or 3) * 1000)
        start = shot_cursor
        end = start + duration_ms
        active = [u for u in utterances if u["startMs"] < end and u["endMs"] > start]
        speakers = sorted({str(u["speaker"]) for u in active if u.get("speaker")})
        timeline_shots.append({
            "id": shot.get("id"),
            "startMs": start,
            "endMs": end,
            "speakers": speakers,
            "lipSyncRequired": bool(speakers),
            "listenerOnly": not bool(speakers),
            "audioPolicy": "dialogue+room-tone" if speakers else "room-tone+reactions",
            "fallbackPolicy": "clean-original-video-with-synced-audio" if speakers else "keep-original-video",
        })
        shot_cursor = end

    # Editing beats are driven by speech boundaries rather than a rigid metronome.
    edit_points = []
    for utterance in utterances:
        edit_points.append({
            "atMs": utterance["startMs"],
            "kind": "speech-start",
            "speaker": utterance.get("speaker"),
            "priority": "medium",
        })
        edit_points.append({
            "atMs": utterance["endMs"],
            "kind": "reaction-window",
            "speaker": utterance.get("speaker"),
            "holdMs": 280,
            "priority": "high",
            "direction": "prefer the listener reaction or a held look; do not cut instantly just because speech ended",
        })
    edit_points.sort(key=lambda item: int(item["atMs"]))

    return {
        "version": 2,
        "sceneId": scene.get("id"),
        "durationMs": max(shot_cursor, cursor_ms),
        "utterances": utterances,
        "shots": timeline_shots,
        "editPoints": edit_points,
        "editing": {
            "policy": "performance-driven",
            "avoidFixedCadence": True,
            "cutOnReaction": True,
            "allowPostLineHold": True,
            "minimumReactionHoldMs": 280,
            "rule": "Never cut solely because a nominal shot duration elapsed; prefer speech boundaries, gaze shifts, entrances, gestures and listener reactions.",
        },
        "mix": {
            "continuousRoomTone": True,
            "preserveBreaths": True,
            "preserveNaturalSilence": True,
            "voicePerspective": "match character distance and camera perspective",
            "musicPolicy": "never mask dialogue; use only when scene intent calls for it",
        },
        "lipSync": {
            "applyOnlyToSpeakingShots": True,
            "neverRetouchListenerOnlyShots": True,
            "failureIsNonFatal": True,
            "fallback": "assemble clean generated video with synchronized dialogue and ambience",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scene", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--voice-dir")
    args = parser.parse_args()
    scene = json.loads(Path(args.scene).read_text(encoding="utf-8"))
    plan = build_av_plan(scene, Path(args.voice_dir) if args.voice_dir else None)
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(plan, ensure_ascii=False))


if __name__ == "__main__":
    main()
