# MonIA Studio candidates

GPU-generated media lands here as **candidates only**.

Each candidate folder should contain:

- `job.json` — immutable source request
- `result.json` — generation metadata, model/router, seed, duration, errors
- `shot-*.mp4` — generated clips
- optional `last-frame-*.png` — continuity frames
- `review.json` — identity/canon/motion/continuity/voice validation state

No file in this directory is live gameplay media. Production playback is controlled only by locked approved manifests.
