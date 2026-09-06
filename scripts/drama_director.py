from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Literal

ShotType = Literal["wide", "two-shot", "medium", "close-up", "insert", "reaction"]
CHARACTER_BIBLE_PATH = Path("config/drama-character-bible.json")


@dataclass
class CharacterLock:
    key: str
    display_name: str
    canon_ref: str
    voice_profile: str | None
    visual_rules: list[str]
    acting_rules: list[str]
    forbidden: list[str]


@dataclass
class ContinuityState:
    location: str
    time_of_day: str
    weather: str | None = None
    wardrobe: dict[str, str] = field(default_factory=dict)
    props: list[str] = field(default_factory=list)
    emotional_state: dict[str, str] = field(default_factory=dict)
    previous_shot_ref: str | None = None


@dataclass
class DramaShot:
    id: str
    scene_id: str
    order: int
    shot_type: ShotType
    duration_s: float
    characters: list[str]
    visual_action: str
    emotion: dict[str, str]
    camera: str
    dialogue: dict[str, str] | None
    ambience: str
    continuity: ContinuityState
    identity_refs: dict[str, str]
    generation_status: str = "planned"
    quality_status: str = "pending"


@dataclass
class DramaScene:
    id: str
    title: str
    dramatic_goal: str
    location: str
    time_of_day: str
    shots: list[DramaShot]


@dataclass
class EpisodePlan:
    version: int
    title: str
    format: str
    target_duration_s: int
    characters: dict[str, CharacterLock]
    scenes: list[DramaScene]
    rules: dict[str, object]


def load_character_bible(path: Path = CHARACTER_BIBLE_PATH) -> tuple[dict[str, CharacterLock], dict[str, object]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("status") != "locked":
        raise RuntimeError("Drama character bible must be locked before generation")

    characters: dict[str, CharacterLock] = {}
    for key, raw in data.get("characters", {}).items():
        voice = raw.get("voice_profile") or {}
        characters[key] = CharacterLock(
            key=key,
            display_name=str(raw.get("display_name") or key.title()),
            canon_ref=str(raw["identity_reference"]),
            voice_profile=str(voice.get("status") or "pending-validation"),
            visual_rules=list(raw.get("visual_rules") or []),
            acting_rules=list(raw.get("acting_rules") or []),
            forbidden=list(raw.get("forbidden") or []),
        )
    if "marion" not in characters or "lucas" not in characters:
        raise RuntimeError("Drama character bible must define Marion and Lucas")
    return characters, dict(data.get("global_story_rules") or {})


def split_dialogue(script: str) -> list[tuple[str | None, str]]:
    parts: list[tuple[str | None, str]] = []
    pattern = re.compile(r"(?im)^\s*(marion|lucas)\s*[:\-]\s*(.+?)\s*$")
    for match in pattern.finditer(script):
        parts.append((match.group(1).lower(), match.group(2).strip()))
    if not parts and script.strip():
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", script.strip()) if s.strip()]
        parts.extend((None, s) for s in sentences)
    return parts


def _shot_pattern(index: int, has_dialogue: bool) -> ShotType:
    if index == 0:
        return "wide"
    if has_dialogue:
        return "close-up" if index % 2 else "two-shot"
    return "reaction" if index % 2 else "medium"


def _continuity_after(base: ContinuityState, previous_shot_ref: str | None) -> ContinuityState:
    return ContinuityState(
        location=base.location,
        time_of_day=base.time_of_day,
        weather=base.weather,
        wardrobe=dict(base.wardrobe),
        props=list(base.props),
        emotional_state=dict(base.emotional_state),
        previous_shot_ref=previous_shot_ref,
    )


def build_episode_plan(
    title: str,
    script: str,
    location: str,
    time_of_day: str,
    target_duration_s: int = 45,
) -> EpisodePlan:
    characters, story_rules = load_character_bible()
    beats = split_dialogue(script)
    if not beats:
        beats = [(None, "A quiet cinematic beat between Marion and Lucas.")]

    base_continuity = ContinuityState(
        location=location,
        time_of_day=time_of_day,
        wardrobe={"marion": "locked for scene", "lucas": "locked for scene"},
        emotional_state={"marion": "natural", "lucas": "natural"},
    )

    shots: list[DramaShot] = []
    opening = DramaShot(
        id="S01-SH01",
        scene_id="S01",
        order=1,
        shot_type="wide",
        duration_s=3.0,
        characters=["marion", "lucas"],
        visual_action=f"Establish {location} and the physical relationship between Marion and Lucas.",
        emotion={"marion": "contained", "lucas": "contained"},
        camera="slow restrained establishing move, no flashy motion",
        dialogue=None,
        ambience="natural room tone and subtle environment sound",
        continuity=_continuity_after(base_continuity, None),
        identity_refs={k: characters[k].canon_ref for k in ("marion", "lucas")},
    )
    shots.append(opening)

    for speaker, text in beats:
        shot_order = len(shots) + 1
        chars = [speaker] if speaker else ["marion", "lucas"]
        dialogue = {speaker: text} if speaker else None
        shot_type = _shot_pattern(shot_order - 1, dialogue is not None)
        previous_id = shots[-1].id
        shots.append(
            DramaShot(
                id=f"S01-SH{shot_order:02d}",
                scene_id="S01",
                order=shot_order,
                shot_type=shot_type,
                duration_s=4.0 if dialogue else 3.0,
                characters=chars,
                visual_action=(
                    f"{speaker.title()} delivers the line with restrained natural acting."
                    if speaker
                    else text
                ),
                emotion={speaker: "scene-driven"} if speaker else {"marion": "reactive", "lucas": "reactive"},
                camera=(
                    "intimate eye-level close framing, subtle natural handheld drift"
                    if shot_type == "close-up"
                    else "balanced cinematic composition with restrained movement"
                ),
                dialogue=dialogue,
                ambience="continuous ambience from previous shot",
                continuity=_continuity_after(base_continuity, previous_id),
                identity_refs={k: characters[k].canon_ref for k in chars},
            )
        )

        reaction_target = "lucas" if speaker == "marion" else "marion" if speaker == "lucas" else None
        if reaction_target:
            reaction_order = len(shots) + 1
            previous_id = shots[-1].id
            shots.append(
                DramaShot(
                    id=f"S01-SH{reaction_order:02d}",
                    scene_id="S01",
                    order=reaction_order,
                    shot_type="reaction",
                    duration_s=2.2,
                    characters=[reaction_target],
                    visual_action="Silent micro-reaction: eyes, breath and tiny facial change only.",
                    emotion={reaction_target: "subtle reaction to previous line"},
                    camera="locked close reaction shot, no zoom effect",
                    dialogue=None,
                    ambience="continuous ambience from previous shot",
                    continuity=_continuity_after(base_continuity, previous_id),
                    identity_refs={reaction_target: characters[reaction_target].canon_ref},
                )
            )

    scene = DramaScene(
        id="S01",
        title=title,
        dramatic_goal="Create a coherent short-form cinematic beat with escalating emotional attention.",
        location=location,
        time_of_day=time_of_day,
        shots=shots,
    )

    return EpisodePlan(
        version=1,
        title=title,
        format="vertical-micro-drama",
        target_duration_s=target_duration_s,
        characters=characters,
        scenes=[scene],
        rules={
            "aspect_ratio": "9:16",
            "generation_mode": "shot-by-shot",
            "candidate_only": True,
            "auto_publish_live": False,
            "require_identity_validation": True,
            "require_continuity_validation": True,
            "require_voice_validation": True,
            "reuse_previous_frame_when_helpful": True,
            **story_rules,
        },
    )


def quality_gate(plan: EpisodePlan) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    for scene in plan.scenes:
        if len(scene.shots) < 2:
            errors.append(f"{scene.id}: needs at least 2 shots")
        for shot in scene.shots:
            if shot.id in seen_ids:
                errors.append(f"duplicate shot id: {shot.id}")
            seen_ids.add(shot.id)
            if not 1.5 <= shot.duration_s <= 8.0:
                errors.append(f"{shot.id}: duration outside micro-drama range")
            for character in shot.characters:
                if character not in plan.characters:
                    errors.append(f"{shot.id}: unknown character {character}")
                elif character not in shot.identity_refs:
                    errors.append(f"{shot.id}: missing identity reference for {character}")
            if shot.generation_status != "planned":
                errors.append(f"{shot.id}: new plan must start as planned")
            if shot.quality_status != "pending":
                errors.append(f"{shot.id}: new plan must start quality pending")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Marion & Lucas micro-drama director")
    parser.add_argument("--title", default="Marion & Lucas Drama Test")
    parser.add_argument("--script", required=True)
    parser.add_argument("--location", default="apartment")
    parser.add_argument("--time", dest="time_of_day", default="morning")
    parser.add_argument("--duration", type=int, default=45)
    parser.add_argument("--output", type=Path, default=Path(".monia-video/episode-plan.json"))
    args = parser.parse_args()

    plan = build_episode_plan(args.title, args.script, args.location, args.time_of_day, args.duration)
    errors = quality_gate(plan)
    if errors:
        raise SystemExit("Drama plan rejected:\n- " + "\n- ".join(errors))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(asdict(plan), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"DRAMA plan={args.output} scenes={len(plan.scenes)} shots={sum(len(s.shots) for s in plan.scenes)}")


if __name__ == "__main__":
    main()
