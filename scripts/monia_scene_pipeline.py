from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from scripts.monia_scene_director import direct_scene
from scripts.monia_scene_worker import run_job
from scripts.monia_scene_av_planner import build_av_plan


def _write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def run_pipeline(spec_path: Path, work_dir: Path, publish_candidates: bool = False) -> dict[str, Any]:
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
        rendered_voices = list(voice_dir.glob("line-*.wav")) if voice_dir.exists() else []
        if rendered_voices:
            av_measured = build_av_plan(scene, voice_dir)
            av_measured_path = work_dir / "av-plan-measured.json"
            _write(av_measured_path, av_measured)
            stage("voice-timing", "ready", output=str(av_measured_path), renderedLines=len(rendered_voices))
        else:
            stage(
                "voice-timing",
                "awaiting-renderer",
                reason="No per-line rendered WAV files yet; estimated AV plan remains authoritative until voice rendering is connected.",
            )

        stage(
            "lipsync",
            "awaiting-renderer" if not rendered_voices else "ready-for-speaking-shots",
            policy="lip-sync speaking shots only; failure must remain non-fatal",
        )

        video_ready = str(video_result.get("status") or "").startswith("candidate")
        journal["status"] = "candidate-video-ready" if video_ready else "partial"
        journal["nextRequiredStage"] = "voice-renderer" if not rendered_voices else "targeted-lipsync-and-final-mix"
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
    args = parser.parse_args()
    print(json.dumps(run_pipeline(args.spec, args.work_dir, args.publish_candidates), ensure_ascii=False))


if __name__ == "__main__":
    main()
