#!/usr/bin/env python3
import json
import shutil
import subprocess
import sys


def command_output(args):
    try:
        return subprocess.check_output(args,text=True,stderr=subprocess.DEVNULL,timeout=8).strip()
    except Exception:
        return ''


def detect_gpu():
    raw=command_output(['nvidia-smi','--query-gpu=name,memory.total','--format=csv,noheader,nounits'])
    if not raw:
        return []
    result=[]
    for line in raw.splitlines():
        try:
            name,memory=line.rsplit(',',1)
            result.append({'name':name.strip(),'vramMB':int(memory.strip())})
        except Exception:
            pass
    return result


def recommendation(vram_mb):
    gb=vram_mb/1024
    if gb>=24:
        return {
            'backend':'wan2.2-ti2v-5b',
            'quality':'high',
            'reason':'24 Go ou plus: profil local 720p text/image-to-video prioritaire.',
            'fallback':'hunyuanvideo-1.5',
        }
    if gb>=14:
        return {
            'backend':'hunyuanvideo-1.5',
            'quality':'balanced',
            'reason':'14 Go ou plus: profil léger avec offloading adapté.',
            'fallback':None,
        }
    if gb>=8:
        return {
            'backend':'preview-only',
            'quality':'preview',
            'reason':'VRAM limitée: garder MonIA Drama Planner et utiliser des previews courtes/faible résolution avant d’installer un modèle lourd.',
            'fallback':None,
        }
    return {
        'backend':'storyboard-only',
        'quality':'storyboard',
        'reason':'Pas assez de VRAM NVIDIA détectée pour notre cible photoréaliste locale actuelle.',
        'fallback':None,
    }


def main():
    gpus=detect_gpu()
    best=max((g['vramMB'] for g in gpus),default=0)
    report={
        'python':sys.version.split()[0],
        'ffmpeg':bool(shutil.which('ffmpeg')),
        'nvidiaSmi':bool(shutil.which('nvidia-smi')),
        'gpus':gpus,
        'bestVRAMGB':round(best/1024,1),
        'recommendation':recommendation(best),
    }
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
