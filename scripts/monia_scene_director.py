from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


def _slug(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip()).strip("-").lower()[:80] or "scene"


def direct_scene(spec: dict[str, Any]) -> dict[str, Any]:
    scene_id = _slug(str(spec.get("id") or spec.get("title") or "monia-directed-scene"))
    actors = [str(a) for a in spec.get("actors") or ["Marion", "Lucas"]]
    actor_references = spec.get("actorReferences") or {}
    canonical_builtin = {"marion", "lucas"}
    missing = [a for a in actors if a.lower() not in canonical_builtin and not actor_references.get(a)]
    if missing:
        raise ValueError("Recurring character reference required before generation: " + ", ".join(missing))
    intent = str(spec.get("intent") or "").strip()
    if not intent:
        raise ValueError("Scene intent is required")

    location = str(spec.get("location") or "believable lived-in environment")
    time_of_day = str(spec.get("timeOfDay") or "natural time of day")
    mood = str(spec.get("mood") or "natural, intimate, unscripted")
    wardrobe = spec.get("wardrobe") or {}
    appearance = spec.get("appearance") or {}
    spatial = spec.get("spatial") or {}
    mode = str(spec.get("mode") or "cinematic").lower()
    dialogue = spec.get("dialogue") or []
    performance_beats = []
    for index, line in enumerate(dialogue):
        if not isinstance(line, dict):
            continue
        speaker = str(line.get("speaker") or "").strip()
        text = str(line.get("text") or "").strip()
        if not speaker or not text:
            continue
        listeners = [a for a in actors if a.lower() != speaker.lower()]
        performance_beats.append({
            "index": index + 1,
            "speaker": speaker,
            "text": text,
            "intent": line.get("intent") or "speak naturally to the other character, never recite",
            "emotion": line.get("emotion") or mood,
            "delivery": line.get("delivery") or "human conversational timing with subtle breath and imperfect micro-pauses",
            "listeners": listeners,
            "listenerBehavior": line.get("listenerBehavior") or "listen actively with tiny eye, breath and facial reactions; never freeze while the speaker talks",
            "allowOverlap": bool(line.get("allowOverlap", False)),
            "pauseBeforeMs": int(line.get("pauseBeforeMs") or 0),
            "pauseAfterMs": int(line.get("pauseAfterMs") or 180),
        })

    if mode == "visio":
        shots = [{
            "id": "front-camera",
            "focusActor": str(spec.get("focusActor") or "Lucas"),
            "actors": actors,
            "duration": 6,
            "prompt": (
                f"{intent}. Smartphone front-camera video call. The viewer is the other participant through the invisible phone camera. "
                "Arm-length framing, tiny imperfect handheld drift, natural breathing, irregular blinking, gaze alternating between screen and lens. "
                "No external camera, no visible phone, no cinematic cutaway, no UI."
            ),
        }]
    else:
        beats = spec.get("beats") or [
            "Establish the place and the characters already present with natural activity, not posing.",
            "Move into a human medium shot as the interaction begins; preserve screen direction and physical geography.",
            "Show the important arrival, action or emotional change requested by the scene intent.",
            "Move closer for the most meaningful reaction or exchange, with subtle facial micro-expression and believable eye-lines.",
            "End on a natural consequence or quiet reaction that can cut cleanly into gameplay.",
        ]
        shot_types = ["establishing", "medium", "action", "close-reaction", "exit-beat"]
        durations = [4, 5, 5, 5, 4]
        shots = []
        for index, beat in enumerate(beats[:5]):
            focus = str(spec.get("focusActor") or (actors[-1] if index >= 2 else actors[0]))
            shots.append({
                "id": shot_types[index] if index < len(shot_types) else f"beat-{index+1}",
                "focusActor": focus,
                "actors": actors,
                "duration": durations[index] if index < len(durations) else 4,
                "prompt": (
                    f"Photorealistic premium live-action scene. Overall intent: {intent}. "
                    f"Current dramatic beat: {beat} Mood: {mood}. "
                    "Natural human blocking, imperfect timing, realistic eye-lines, breathing and micro-reactions. "
                    "Camera placement must feel motivated by the previous shot, never like an unrelated generated clip."
                ),
            })

    return {
        "id": scene_id,
        "format": str(spec.get("format") or "16:9"),
        "continuityKey": str(spec.get("continuityKey") or scene_id),
        "approvalRequired": True,
        "autoPublish": False,
        "sceneAnchor": spec.get("sceneAnchor"),
        "actorReferences": actor_references,
        "continuityState": {
            "location": location,
            "timeOfDay": time_of_day,
            "lighting": spec.get("lighting") or "physically coherent natural lighting",
            "cameraAxis": spec.get("cameraAxis") or "preserve screen direction and eyelines across cuts",
            "wardrobe": wardrobe,
            "appearance": appearance,
            "spatial": spatial,
            "lockedElements": spec.get("lockedElements") or [
                "character identities",
                "wardrobe",
                "hair",
                "tattoos",
                "location geometry",
                "props",
                "screen direction",
            ],
        },
        "performance": {
            "dialogue": performance_beats,
            "voiceRules": {
                "Dominic": "use current approved/candidate Dominic voice strategy; preserve stable identity while emotion and energy vary naturally",
                "global": "no announcer cadence, no word-by-word delivery, no perfectly even pauses; preserve breaths, hesitation, interruption and listener reactions when context calls for them",
            },
            "syncRules": [
                "lip sync only the active speaker",
                "listeners keep natural micro-motion",
                "reaction may begin before a line fully ends",
                "room tone continues through cuts",
                "voice distance must match camera and character position",
            ],
        },
        "director": {
            "engine": "monia-scene-director-v2",
            "sourceIntent": intent,
            "mode": mode,
            "rules": [
                "story causality before visual spectacle",
                "identity and continuity before camera novelty",
                "short motivated shots",
                "natural performance over advertisement posing",
                "preserve geography and eyelines",
                "cut for performance and reaction, not merely visual variety",
            ],
        },
        "shots": shots,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Turn a high-level MonIA scene request into a renderable shot plan")
    parser.add_argument("--spec", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    job = direct_scene(spec)
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(job, ensure_ascii=False))


if __name__ == "__main__":
    main()
