from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any

from scripts.monia_lucas_v16_runtime_voice import render_line as render_dominic


def render_scene_dialogue(scene: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    beats = ((scene.get("performance") or {}).get("dialogue") or [])
    rendered = []
    blocked = []
    for position, beat in enumerate(beats, start=1):
        index = int(beat.get("index") or position)
        speaker = str(beat.get("speaker") or "").strip()
        text = str(beat.get("text") or "").strip()
        if not speaker or not text:
            continue
        target = output_dir / f"line-{index:03d}.wav"
        if speaker.lower() in {"lucas", "dominic"}:
            emotion = str(beat.get("emotion") or "neutral").lower()
            allowed = {"neutral", "warm", "amused", "tender", "concerned", "tired", "whisper"}
            if emotion not in allowed:
                emotion = "neutral"
            manifest = render_dominic(text, emotion, f"{scene.get('id')}-line-{index}", False)
            shutil.copy2(Path(manifest["output"]), target)
            rendered.append({
                "index": index, "speaker": speaker, "path": str(target),
                "duration": manifest["duration"], "voiceId": manifest["voice_id"],
                "status": "rendered",
            })
        else:
            blocked.append({
                "index": index, "speaker": speaker, "status": "voice-reference-required",
                "reason": f"Stable canonical voice for {speaker} is not configured; refusing random recurring voice.",
            })

    result = {
        "sceneId": scene.get("id"),
        "status": "complete" if not blocked else ("partial" if rendered else "blocked"),
        "rendered": rendered,
        "blocked": blocked,
    }
    (output_dir / "voice-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Render MonIA scene dialogue with stable per-character voice routing")
    parser.add_argument("--scene", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    scene = json.loads(args.scene.read_text(encoding="utf-8"))
    print(json.dumps(render_scene_dialogue(scene, args.output_dir), ensure_ascii=False))


if __name__ == "__main__":
    main()
