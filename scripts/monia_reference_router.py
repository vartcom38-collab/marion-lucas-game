from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

CONFIG = Path("config/lucas-video-bank.json")


@dataclass(frozen=True)
class ReferencePlan:
    character: str
    media_type: str
    required_roles: tuple[str, ...]
    selected_ids: tuple[str, ...]
    camera_contract: tuple[str, ...]
    rejection_rules: tuple[str, ...]


def _load() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def _score_clip(clip: dict, required: set[str]) -> int:
    roles = set(clip.get("roles", []))
    overlap = len(roles & required)
    priority = {"strong": 8, "medium": 3, "weak": 0}.get(clip.get("priority", "medium"), 0)
    return overlap * 10 + priority


def _choose(clips: list[dict], roles: Iterable[str], limit: int = 4) -> tuple[str, ...]:
    required = set(roles)
    ranked = sorted(clips, key=lambda c: (_score_clip(c, required), c.get("durationSeconds", 0)), reverse=True)
    chosen = [c["id"] for c in ranked if set(c.get("roles", [])) & required]
    return tuple(chosen[:limit])


def plan_lucas(media_type: str, *, speaking: bool = False, private: bool = False) -> ReferencePlan:
    bank = _load()
    clips = bank["clips"]
    media_type = media_type.strip().lower()

    if media_type == "visio":
        roles = ["identity", "gaze", "micro_expression", "head_movement", "gesture_rhythm", "presence"]
        if speaking:
            roles += ["speech_rhythm", "jaw_head_coordination", "energy"]
        if private:
            roles += ["relaxed_posture", "off_duty_presence", "tattoo_continuity"]
        camera = (
            "viewer IS Lucas smartphone front camera",
            "phone never visible",
            "no external camera angle",
            "arm-length human framing",
            "head shoulders and upper torso visible",
            "tiny handheld micro-shake and imperfect drift",
            "natural screen-to-lens gaze changes",
            "phone-like autofocus/exposure breathing",
            "no cinematic zoom dolly pan or cut",
        )
        rejects = (
            "looks like cinematic portrait rather than live call",
            "phone visible",
            "external camera angle",
            "tripod or stabilized framing",
            "Lucas identity drift",
            "wrong eye color or face geometry",
            "tattoo continuity error when visible",
            "frozen listening behavior",
            "unrelated mouth motion when speaking",
        )
    elif media_type == "cinematic":
        roles = ["identity", "posture", "body_movement", "gaze", "micro_expression", "wardrobe_context"]
        camera = ("cinematic camera grammar allowed", "context-driven framing", "identity remains locked")
        rejects = ("Lucas identity drift", "generic replacement actor", "wrong age continuity", "tattoo continuity error")
    elif media_type in {"home", "private", "intimate"}:
        roles = ["identity", "relaxed_posture", "body_movement", "off_duty_presence", "tattoo_continuity", "gesture_rhythm"]
        camera = ("natural private-scene framing", "non-explicit intimacy", "context-driven camera")
        rejects = ("Lucas identity drift", "over-performed gestures", "tattoo continuity error", "copied source shot")
    else:
        roles = ["identity", "presence", "gaze", "general_motion"]
        camera = ("context-driven",)
        rejects = ("Lucas identity drift", "generic replacement actor")

    selected = _choose(clips, roles)
    return ReferencePlan(
        character="lucas",
        media_type=media_type,
        required_roles=tuple(dict.fromkeys(roles)),
        selected_ids=selected,
        camera_contract=camera,
        rejection_rules=rejects,
    )


def as_dict(plan: ReferencePlan) -> dict:
    return {
        "character": plan.character,
        "mediaType": plan.media_type,
        "requiredRoles": list(plan.required_roles),
        "selectedReferences": list(plan.selected_ids),
        "cameraContract": list(plan.camera_contract),
        "rejectionRules": list(plan.rejection_rules),
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="MonIA reference router")
    parser.add_argument("media_type", choices=["visio", "cinematic", "home", "private", "intimate", "generic"])
    parser.add_argument("--speaking", action="store_true")
    parser.add_argument("--private", action="store_true")
    args = parser.parse_args()
    print(json.dumps(as_dict(plan_lucas(args.media_type, speaking=args.speaking, private=args.private)), ensure_ascii=False, indent=2))
