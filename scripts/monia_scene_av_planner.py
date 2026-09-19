from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def build_av_plan(scene: dict[str, Any]) -> dict[str, Any]:
    shots = scene.get("shots") or []
    performance = scene.get("performance") or {}
    dialogue = performance.get("dialogue") or []
    cursor_ms = 0
    utterances = []
    for beat in dialogue:
        before = max(0, int(beat.get("pauseBeforeMs") or 0))
        after = max(0, int(beat.get("pauseAfterMs") or 0))
        cursor_ms += before
        # Runtime voice renderer replaces this estimate with measured WAV duration.
        words = max(1, len(str(beat.get("text") or "").split()))
        estimated_ms = max(650, int(words / 2.45 * 1000))
        start = cursor_ms
        end = start + estimated_ms
        utterances.append({
            "index": beat.get("index"),
            "speaker": beat.get("speaker"),
            "text": beat.get("text"),
            "startMs": start,
            "estimatedEndMs": end,
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
        active = [u for u in utterances if u["startMs"] < end and u["estimatedEndMs"] > start]
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

    return {
        "version": 1,
        "sceneId": scene.get("id"),
        "durationMs": max(shot_cursor, cursor_ms),
        "utterances": utterances,
        "shots": timeline_shots,
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
    args = parser.parse_args()
    scene = json.loads(Path(args.scene).read_text(encoding="utf-8"))
    plan = build_av_plan(scene)
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(plan, ensure_ascii=False))


if __name__ == "__main__":
    main()
