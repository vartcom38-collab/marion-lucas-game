from __future__ import annotations

from copy import deepcopy
from typing import Any


def plan_ambience(scene: dict[str, Any]) -> dict[str, Any]:
    planned = deepcopy(scene)
    continuity = planned.get("continuityState") or {}
    default_location = str(continuity.get("location") or "unknown")
    default_time = str(continuity.get("timeOfDay") or "unspecified")
    layers = []

    for shot in planned.get("shots") or []:
        env = shot.get("environmentContinuity") or {}
        camera = shot.get("cameraGrammar") or {}
        location = str(env.get("location") or default_location)
        time_of_day = str(env.get("timeOfDay") or default_time)
        shot_size = str(camera.get("shotSize") or "medium")
        text = f"{location} {shot.get('prompt') or ''}".lower()

        exterior = any(k in text for k in ["street", "outside", "extérieur", "terrace", "terrasse", "arena", "arènes", "city", "ville"])
        crowded = any(k in text for k in ["crowd", "foule", "bar", "arena", "arènes", "restaurant", "party", "soirée"])
        vehicle = any(k in text for k in ["car", "voiture", "taxi", "vehicle"])

        bed = "quiet interior room presence"
        details = ["subtle air and distant building presence"]
        if vehicle:
            bed = "vehicle interior movement bed"
            details = ["road texture", "soft engine/rolling presence", "distant exterior traffic"]
        elif exterior:
            bed = "natural exterior location bed"
            details = ["distant traffic or environmental movement", "soft air/wind appropriate to location"]
        if crowded:
            details.append("indistinct distant human murmur without intelligible invented speech")

        perspective = "close and restrained" if any(k in shot_size.lower() for k in ["close", "front-camera"]) else "wider environmental perspective"
        plan = {
            "shotId": shot.get("id"),
            "location": location,
            "timeOfDay": time_of_day,
            "bed": bed,
            "details": details,
            "perspective": perspective,
            "sourcePriority": ["production-audio", "validated-monia-asset", "silence"],
            "forbid": ["invented intelligible background dialogue", "stock-cinematic whooshes", "music unless story requests it"],
        }
        shot["ambiencePlan"] = plan
        layers.append(plan)

    return {
        "status": "planned",
        "scene": planned,
        "layers": layers,
        "policy": {
            "productionAudioFirst": True,
            "validatedAssetsOnly": True,
            "noInventedBackgroundSpeech": True,
            "perspectiveMatchesCamera": True,
            "silencePreferredToWrongAmbience": True,
        },
    }
