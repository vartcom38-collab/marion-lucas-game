#!/usr/bin/env python3
import json
import shutil
import subprocess
import sys
from pathlib import Path


def run(args, timeout=30):
    try:
        return subprocess.check_output(args, stderr=subprocess.STDOUT, timeout=timeout).decode('utf-8', 'replace')
    except Exception as exc:
        return f'__ERROR__:{exc}'


def probe(path: Path):
    raw = run([
        'ffprobe','-v','error','-show_entries',
        'format=duration:stream=index,codec_type,width,height,r_frame_rate,avg_frame_rate,sample_rate,channels',
        '-of','json',str(path)
    ])
    if raw.startswith('__ERROR__:'):
        return {'ok': False, 'error': raw[10:]}
    try:
        data=json.loads(raw)
    except Exception as exc:
        return {'ok': False, 'error': f'ffprobe json: {exc}'}
    streams=data.get('streams') or []
    video=next((s for s in streams if s.get('codec_type')=='video'), None)
    audio=next((s for s in streams if s.get('codec_type')=='audio'), None)
    try: duration=float((data.get('format') or {}).get('duration') or 0)
    except Exception: duration=0
    return {
        'ok': bool(video and duration > 0),
        'duration': round(duration, 3),
        'width': int((video or {}).get('width') or 0),
        'height': int((video or {}).get('height') or 0),
        'fps': (video or {}).get('avg_frame_rate') or (video or {}).get('r_frame_rate'),
        'hasAudio': bool(audio),
        'audioChannels': int((audio or {}).get('channels') or 0),
        'sampleRate': int((audio or {}).get('sample_rate') or 0),
    }


def filter_report(path: Path, filter_expr: str):
    if not shutil.which('ffmpeg'):
        return ''
    proc=subprocess.run(
        ['ffmpeg','-hide_banner','-nostats','-i',str(path),'-vf',filter_expr,'-an','-f','null','-'],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, timeout=60
    )
    return proc.stderr or ''


def parse_seconds(lines: str, token: str):
    values=[]
    for line in lines.splitlines():
        if token not in line:
            continue
        try:
            tail=line.split(token,1)[1].strip().split()[0]
            values.append(float(tail))
        except Exception:
            pass
    return values


def inspect(path: Path):
    p=probe(path)
    reasons=[]
    warnings=[]
    if not p.get('ok'):
        reasons.append('video unreadable or missing video stream')
        return {'status':'reject','technical':p,'reasons':reasons,'warnings':warnings}
    duration=float(p.get('duration') or 0)
    width=int(p.get('width') or 0); height=int(p.get('height') or 0)
    if duration < 1.2: reasons.append('candidate duration below 1.2s')
    if width < 360 or height < 640: reasons.append('candidate resolution below minimum portrait review target')
    if duration > 90: warnings.append('candidate unusually long for a gameplay cinematic')

    black=filter_report(path,'blackdetect=d=0.45:pix_th=0.10')
    black_durations=parse_seconds(black,'black_duration:')
    if black_durations:
        longest=max(black_durations)
        if longest >= max(1.0, duration * 0.45): reasons.append('extended black frames detected')
        elif longest >= 0.6: warnings.append('short black segment detected')

    freeze=filter_report(path,'freezedetect=n=-55dB:d=0.8')
    freeze_durations=parse_seconds(freeze,'freeze_duration:')
    if freeze_durations:
        longest=max(freeze_durations)
        if longest >= max(1.8, duration * 0.65): reasons.append('extended frozen frames detected')
        elif longest >= 1.0: warnings.append('noticeable frozen segment detected')

    return {
        'status':'reject' if reasons else 'pass',
        'technical':p,
        'reasons':reasons,
        'warnings':warnings,
        'automaticScope':[
            'container readability','duration','minimum resolution','extended black frames','extended frozen frames'
        ],
        'notAutomaticallyJudged':[
            'Lucas identity','facial resemblance','age continuity','tattoos or scars','micro-expression realism','voice identity','lip synchronization'
        ]
    }


def main():
    if len(sys.argv) != 2:
        print(json.dumps({'status':'error','error':'usage: monia-video-quality.py VIDEO'}, ensure_ascii=False))
        return 2
    path=Path(sys.argv[1])
    report=inspect(path)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 3 if report.get('status')=='reject' else 0


if __name__=='__main__':
    raise SystemExit(main())
