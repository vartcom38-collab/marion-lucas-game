from __future__ import annotations

# MonIA quality-proof trigger: cached video + resilient V16 clock.

import argparse
import json
import os
import shutil
from pathlib import Path

from gradio_client import Client, handle_file


def run(video: Path, audio: Path, output: Path) -> dict:
    if not video.exists() or not audio.exists():
        raise FileNotFoundError("video or audio input missing")
    space=os.environ.get("MONIA_LIPSYNC_SPACE","henrybit/musetalk-1-5")
    token=os.environ.get("HF_TOKEN","").strip() or None
    client=Client(space,hf_token=token,verbose=False)
    result=client.predict(
        handle_file(str(audio)),
        handle_file(str(video)),
        0,
        10,
        "jaw",
        90,
        90,
        fn_index=0,
    )
    candidate=result[0] if isinstance(result,(list,tuple)) else result
    if isinstance(candidate,dict):
        candidate=candidate.get("path") or candidate.get("name") or candidate.get("url")
    if not candidate:
        raise RuntimeError(f"MuseTalk returned no video: {result!r}")
    source=Path(str(candidate))
    if not source.exists():
        raise RuntimeError(f"MuseTalk result not materialized locally: {candidate}")
    output.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,output)
    if output.stat().st_size < 100000:
        raise RuntimeError("lip-sync output too small")
    return {"space":space,"output":str(output),"bytes":output.stat().st_size}


def main() -> None:
    p=argparse.ArgumentParser()
    p.add_argument("--video",type=Path,required=True)
    p.add_argument("--audio",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    print(json.dumps(run(args.video,args.audio,args.output),ensure_ascii=False))


if __name__=="__main__":
    main()
