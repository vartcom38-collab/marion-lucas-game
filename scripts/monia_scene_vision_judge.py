from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageStat, ImageFilter


def _frame_signature(path: Path) -> tuple[float, float, float, float]:
    image = Image.open(path).convert("RGB").resize((96, 96))
    stat = ImageStat.Stat(image)
    mean = tuple(float(x) for x in stat.mean)
    gray = image.convert("L")
    edges = ImageChops.difference(gray, gray.filter(ImageFilter.GaussianBlur(2)))
    edge_energy = float(ImageStat.Stat(edges).mean[0])
    return mean[0], mean[1], mean[2], edge_energy


def _distance(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def judge_samples(samples: dict[str, Any]) -> dict[str, Any]:
    decisions = []
    for sample in samples.get("samples") or []:
        frames = [Path(x) for x in sample.get("frames") or [] if Path(x).exists()]
        if len(frames) < 3:
            decisions.append({
                "shotId": sample.get("shotId"), "decision": "review-required",
                "confidence": 0.0, "reasons": ["insufficient-frame-samples"],
            })
            continue
        signatures = [_frame_signature(frame) for frame in frames]
        jumps = [_distance(signatures[i], signatures[i - 1]) for i in range(1, len(signatures))]
        avg_jump = sum(jumps) / len(jumps)
        max_jump = max(jumps)
        # Conservative thresholds: this stage only rejects gross temporal discontinuity.
        if max_jump > 95 and avg_jump > 48:
            decision = "reject"
            reasons = ["temporal-morphing"]
            confidence = min(0.95, 0.70 + (max_jump - 95) / 300)
        else:
            decision = "review-required"
            reasons = ["semantic-identity-review-required"]
            confidence = 0.0
        decisions.append({
            "shotId": sample.get("shotId"),
            "decision": decision,
            "confidence": round(confidence, 3),
            "reasons": reasons,
            "metrics": {
                "averageFrameJump": round(avg_jump, 3),
                "maximumFrameJump": round(max_jump, 3),
                "sampleCount": len(frames),
            },
        })
    return {
        "version": 1,
        "status": "semantic-review-required" if decisions else "no-samples",
        "shots": decisions,
        "capabilities": {
            "grossTemporalDiscontinuity": True,
            "canonicalIdentityRecognition": False,
            "anatomyRecognition": False,
            "performanceRecognition": False,
        },
        "policy": "Never approve identity from pixel statistics. This judge may reject gross temporal instability but semantic approval requires a vision evaluator.",
    }


def main(samples_path: Path, output: Path) -> None:
    samples = json.loads(samples_path.read_text(encoding="utf-8"))
    result = judge_samples(samples)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--samples", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    main(a.samples, a.output)
