#!/usr/bin/env python3
import json
import os
import queue
import subprocess
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST=os.environ.get('MONIA_VIDEO_HOST','127.0.0.1')
PORT=int(os.environ.get('MONIA_VIDEO_PORT','8765'))
ROOT=Path(os.environ.get('MONIA_VIDEO_OUTPUT',Path.home()/'MonIA'/'renders')).expanduser()
ROOT.mkdir(parents=True,exist_ok=True)
RENDER_COMMAND=os.environ.get('MONIA_VIDEO_RENDER_COMMAND','').strip()

renders={}
work=queue.Queue()
lock=threading.Lock()

def public_job(job):
    return {k:v for k,v in job.items() if k not in {'prompt','localPath'}}

def public_render(render):
    return {
        'renderId':render['renderId'],
        'state':render['state'],
        'jobs':[public_job(j) for j in render['jobs']],
        'finalUrl':render.get('finalUrl'),
        'error':render.get('error'),
    }

def run_external(prompt, duration, output_path, shot):
    if not RENDER_COMMAND:
        raise RuntimeError('Aucun backend vidéo configuré. Définir MONIA_VIDEO_RENDER_COMMAND.')
    env=os.environ.copy()
    env.update({
        'MONIA_PROMPT':prompt,
        'MONIA_DURATION':str(duration),
        'MONIA_OUTPUT':str(output_path),
        'MONIA_SHOT_JSON':json.dumps(shot,ensure_ascii=False),
    })
    command=RENDER_COMMAND.format(output=str(output_path),duration=duration,prompt=prompt)
    subprocess.run(command,shell=True,check=True,env=env)
    if not output_path.exists():
        raise RuntimeError('Le backend a terminé sans créer le clip attendu.')

def concat_manifest(paths, target):
    manifest=target.with_suffix('.txt')
    manifest.write_text(''.join(f"file '{str(p).replace("'","'\\''")}'\n" for p in paths),encoding='utf-8')
    try:
        subprocess.run(['ffmpeg','-y','-f','concat','-safe','0','-i',str(manifest),'-c','copy',str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    finally:
        manifest.unlink(missing_ok=True)

def worker():
    while True:
        render_id=work.get()
        with lock:
            render=renders.get(render_id)
            if not render:
                work.task_done(); continue
            render['state']='rendering'
        folder=ROOT/render_id
        folder.mkdir(parents=True,exist_ok=True)
        clips=[]
        try:
            for job in render['jobs']:
                with lock:
                    job['state']='generating'; job['progress']=5
                output=folder/f"{job['shotId']}.mp4"
                run_external(job['prompt'],job['duration'],output,job['shot'])
                clips.append(output)
                with lock:
                    job['state']='ready'; job['progress']=100; job['clipUrl']=f'/files/{render_id}/{output.name}'
            final=folder/'final.mp4'
            concat_manifest(clips,final)
            with lock:
                render['state']='ready'; render['finalUrl']=f'/files/{render_id}/final.mp4'
        except Exception as exc:
            with lock:
                render['state']='error'; render['error']=str(exc)[:500]
                for job in render['jobs']:
                    if job['state']=='generating':
                        job['state']='error'; job['error']=render['error']
        finally:
            work.task_done()

threading.Thread(target=worker,daemon=True).start()

class Handler(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Headers','content-type')
        self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
    def send_json(self,status,data):
        payload=json.dumps(data,ensure_ascii=False).encode('utf-8')
        self.send_response(status); self.cors(); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(payload))); self.end_headers(); self.wfile.write(payload)
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()
    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/health':
            self.send_json(200,{'ok':True,'name':'MonIA Video Runner','backendConfigured':bool(RENDER_COMMAND),'output':str(ROOT)})
            return
        if path.startswith('/render/'):
            rid=path.split('/')[-1]
            with lock: render=renders.get(rid)
            if not render:self.send_json(404,{'error':'render not found'}); return
            self.send_json(200,public_render(render)); return
        if path.startswith('/files/'):
            rel=Path(path[len('/files/'):])
            target=(ROOT/rel).resolve()
            if ROOT.resolve() not in target.parents or not target.is_file():
                self.send_error(404); return
            data=target.read_bytes(); self.send_response(200); self.cors(); self.send_header('Content-Type','video/mp4'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data); return
        self.send_json(404,{'error':'not found'})
    def do_POST(self):
        if urlparse(self.path).path!='/render': self.send_json(404,{'error':'not found'}); return
        try:
            size=int(self.headers.get('Content-Length','0'))
            body=json.loads(self.rfile.read(size) or b'{}')
            plan=body.get('plan') or {}
            shots=plan.get('shots') or []
            if not shots: raise ValueError('Aucun plan à rendre.')
            rid=str(body.get('renderId') or f'drama-{uuid.uuid4().hex[:10]}')
            jobs=[]
            for shot in shots:
                prompt=str(shot.get('prompt') or '').strip()
                if not prompt: raise ValueError(f"Prompt manquant pour {shot.get('id','shot')}")
                jobs.append({'id':f"{rid}-{shot.get('id')}",'shotId':str(shot.get('id')),'state':'queued','progress':0,'duration':float(shot.get('duration') or 3),'prompt':prompt,'shot':shot})
            render={'renderId':rid,'state':'queued','jobs':jobs,'createdAt':time.time(),'plan':plan}
            with lock:renders[rid]=render
            (ROOT/rid).mkdir(parents=True,exist_ok=True)
            (ROOT/rid/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
            work.put(rid)
            self.send_json(202,{'renderId':rid,'state':'queued'})
        except Exception as exc:
            self.send_json(400,{'error':str(exc)})
    def log_message(self,fmt,*args):
        print('[MonIA Video]',fmt%args)

if __name__=='__main__':
    print(f'MonIA Video Runner http://{HOST}:{PORT}')
    print('Backend configuré:',bool(RENDER_COMMAND))
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
