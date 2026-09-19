from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from scripts.monia_scene_director import direct_scene
from scripts.monia_scene_worker import run_job
from scripts.monia_scene_av_planner import build_av_plan
from scripts.monia_scene_voice_renderer import render_scene_dialogue
from scripts.monia_scene_lipsync import apply_targeted_lipsync
from scripts.monia_scene_final_mix import assemble_final
from scripts.monia_scene_visual_qa import write_contract
from scripts.monia_scene_qa_sampler import extract_review_frames
from scripts.monia_scene_vision_judge import judge_samples
from scripts.monia_scene_identity_review import write_identity_review
from scripts.monia_scene_repair_runner import execute_repair_pass
from scripts.monia_story_logic import validate_story_logic
from scripts.monia_story_repair import repair_story_logic
from scripts.monia_scene_blocking import plan_blocking
from scripts.monia_scene_camera import plan_camera
from scripts.monia_scene_emotion import plan_emotional_continuity
from scripts.monia_scene_human_behavior import plan_human_behavior


def _write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def run_pipeline(spec_path: Path, work_dir: Path, publish_candidates: bool = False, semantic_verdict: Path | None = None) -> dict[str, Any]:
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    work_dir.mkdir(parents=True, exist_ok=True)
    journal_path = work_dir / "pipeline.json"
    journal: dict[str, Any] = {
        "version": 1,
        "status": "running",
        "spec": str(spec_path),
        "stages": {},
    }

    def stage(name: str, status: str, **extra: Any) -> None:
        journal["stages"][name] = {"status": status, **extra}
        _write(journal_path, journal)

    try:
        scene = direct_scene(spec)
        scene_path = work_dir / "scene.json"
        _write(scene_path, scene)
        stage("direct", "ready", output=str(scene_path), shots=len(scene.get("shots") or []))

        story_logic = validate_story_logic(scene)
        story_logic_path = work_dir / "story-logic.json"
        _write(story_logic_path, story_logic)
        stage("story-logic", story_logic.get("status") or "unknown", output=str(story_logic_path))
        journal["storyLogic"] = story_logic
        if story_logic.get("status") == "invalid":
            story_repair = repair_story_logic(scene)
            _write(work_dir / "story-repair.json", story_repair)
            stage("story-auto-repair", story_repair.get("status") or "unknown", output=str(work_dir / "story-repair.json"))
            if story_repair.get("status") == "repaired":
                scene = story_repair["scene"]
                _write(scene_path, scene)
                story_logic = story_repair["validation"]
                journal["storyLogic"] = story_logic
                stage("story-logic", story_logic.get("status") or "unknown", output=str(story_logic_path), repaired=True)
            else:
                journal["status"] = "blocked-story-logic"
                journal["nextRequiredStage"] = "director-revision"
                _write(journal_path, journal)
                return journal

        blocking = plan_blocking(scene)
        scene = blocking["scene"]
        _write(scene_path, scene)
        _write(work_dir / "blocking-plan.json", blocking)
        stage("blocking", blocking.get("status") or "unknown", output=str(work_dir / "blocking-plan.json"))

        camera = plan_camera(scene)
        scene = camera["scene"]
        _write(scene_path, scene)
        _write(work_dir / "camera-plan.json", camera)
        stage("camera", camera.get("status") or "unknown", output=str(work_dir / "camera-plan.json"))

        emotion = plan_emotional_continuity(scene)
        scene = emotion["scene"]
        _write(scene_path, scene)
        _write(work_dir / "emotion-plan.json", emotion)
        stage("emotion", emotion.get("status") or "unknown", output=str(work_dir / "emotion-plan.json"))

        behavior = plan_human_behavior(scene)
        scene = behavior["scene"]
        _write(scene_path, scene)
        _write(work_dir / "human-behavior-plan.json", behavior)
        stage("human-behavior", behavior.get("status") or "unknown", output=str(work_dir / "human-behavior-plan.json"))

        av_initial = build_av_plan(scene)
        av_initial_path = work_dir / "av-plan-estimated.json"
        _write(av_initial_path, av_initial)
        stage("av-estimate", "ready", output=str(av_initial_path), durationMs=av_initial.get("durationMs"))

        stage("video", "running")
        video_result = run_job(scene_path, publish_candidates)
        video_result_path = work_dir / "video-result.json"
        _write(video_result_path, video_result)
        stage("video", video_result.get("status") or "unknown", output=str(video_result_path))

        voice_dir = work_dir / "voices"
        stage("voices", "running")
        voice_result = render_scene_dialogue(scene, voice_dir)
        stage("voices", voice_result.get("status") or "unknown", output=str(voice_dir / "voice-result.json"), blocked=voice_result.get("blocked") or [])

        rendered_voices = list(voice_dir.glob("line-*.wav"))
        if rendered_voices:
            av_measured = build_av_plan(scene, voice_dir)
            av_measured_path = work_dir / "av-plan-measured.json"
            _write(av_measured_path, av_measured)
            stage("voice-timing", "ready", output=str(av_measured_path), renderedLines=len(rendered_voices))
        else:
            stage("voice-timing", "blocked", reason="No stable character voice could be rendered.")

        video_ready = str(video_result.get("status") or "").startswith("candidate")
        lipsync_result = None
        if video_ready and rendered_voices:
            measured_plan = av_measured if rendered_voices else av_initial
            stage("lipsync", "running", policy="speaking shots only; non-fatal fallback")
            lipsync_result = apply_targeted_lipsync(video_result, measured_plan, voice_dir, work_dir / "lipsync")
            stage("lipsync", lipsync_result.get("status") or "unknown", output=str(work_dir / "lipsync" / "lipsync-result.json"))
        else:
            stage("lipsync", "blocked", reason="candidate video and at least one stable rendered voice are required")

        voices_complete = voice_result.get("status") == "complete"
        lipsync_ready = bool(lipsync_result and lipsync_result.get("status") in {"ready", "partial"})
        final_result = None
        if video_ready and rendered_voices and lipsync_ready:
            stage("final-mix", "running")
            final_result = assemble_final(lipsync_result, av_measured, work_dir / "final")
            stage("final-mix", final_result.get("status") or "unknown", output=final_result.get("output"), bytes=final_result.get("bytes"))
        else:
            stage("final-mix", "blocked", reason="candidate video, rendered voice and usable lip-sync plan are required")

        final_ready = bool(final_result and final_result.get("status") in {"av-candidate", "picture-only"})
        journal["status"] = "final-candidate-ready" if final_ready and voices_complete else ("candidate-video-ready" if video_ready else "partial")
        journal["finalCandidate"] = final_result
        if final_ready:
            qa_dir = work_dir / "qa"
            qa_contract = write_contract(scene, video_result, qa_dir / "visual-qa-contract.json")
            qa_samples = extract_review_frames(video_result, qa_dir / "samples")
            temporal_judgement = judge_samples(qa_samples)
            _write(qa_dir / "temporal-judge.json", temporal_judgement)
            identity_review = write_identity_review(scene, qa_samples, qa_dir / "identity-review.json")
            stage(
                "visual-qa-preparation",
                "ready" if qa_samples.get("status") == "ready" else "partial",
                contract=str(qa_dir / "visual-qa-contract.json"),
                samples=str(qa_dir / "samples" / "samples.json"),
                temporalJudge=str(qa_dir / "temporal-judge.json"),
                identityReview=str(qa_dir / "identity-review.json"),
                temporalStatus=temporal_judgement.get("status"),
                identityStatus=identity_review.get("status"),
                evaluatorRequired=qa_contract.get("policy", {}).get("approvalRequiresSemanticVisionEvaluator", True),
            )
            journal["status"] = "awaiting-visual-semantic-qa"
            journal["nextRequiredStage"] = "semantic-vision-evaluator"
            if semantic_verdict and semantic_verdict.exists():
                raw_verdict = json.loads(semantic_verdict.read_text(encoding="utf-8"))
                stage("repair", "running", verdict=str(semantic_verdict))
                repair = execute_repair_pass(scene, video_result, raw_verdict, work_dir / "repair", publish_candidates)
                stage("repair", repair.get("status") or "unknown", output=str(work_dir / "repair"))
                journal["repair"] = repair
                if repair.get("status") == "repair-applied":
                    journal["status"] = "repaired-candidate-ready"
                    journal["nextRequiredStage"] = "rerun-visual-semantic-qa-on-repaired-shots"
        else:
            journal["nextRequiredStage"] = "resolve-blocked-stage"
    except Exception as exc:
        journal["status"] = "failed"
        journal["error"] = str(exc)

    _write(journal_path, journal)
    return journal


def main() -> None:
    parser = argparse.ArgumentParser(description="Orchestrate a complete MonIA cinematic scene pipeline")
    parser.add_argument("--spec", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--publish-candidates", action="store_true")
    parser.add_argument("--semantic-verdict", type=Path)
    args = parser.parse_args()
    print(json.dumps(run_pipeline(args.spec, args.work_dir, args.publish_candidates, args.semantic_verdict), ensure_ascii=False))


if __name__ == "__main__":
    main()
