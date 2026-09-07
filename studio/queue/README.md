# MonIA Studio queue

This directory contains **candidate-only** GPU generation requests.

Rules:

- Jobs are created from gameplay-authorized events, spoiler-safe anticipation, or explicit review regeneration.
- `candidateOnly` must always be `true`.
- `narrativeAuthority` must always be `false`.
- GPU output is written to `studio/candidates/<job-id>/` and is never a live gameplay asset.
- Only the review/publish step may copy an approved result into the production media manifest.
- Motion references may guide blocking, timing, posture and camera movement, but must never supply character identity.
- Character identity always comes from canonical Marion/Lucas references.
- Failure or GPU unavailability must never block gameplay.

One heavy job at a time is the default policy.
