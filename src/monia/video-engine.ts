import type { MonIADramaPlan, MonIADramaShot } from './drama';

export type MonIAVideoJobState='queued'|'generating'|'ready'|'error';
export type MonIAVideoJob={
  id:string;
  shotId:string;
  state:MonIAVideoJobState;
  progress:number;
  clipUrl?:string;
  error?:string;
};
export type MonIAVideoRender={
  id:string;
  state:'queued'|'rendering'|'ready'|'error'|'runner-offline';
  jobs:MonIAVideoJob[];
  finalUrl?:string;
  error?:string;
};

type Listener=(render:MonIAVideoRender)=>void;
const DEFAULT_RUNNER='http://127.0.0.1:8765';

function renderId(){return `drama-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function shotPayload(shot:MonIADramaShot){
  return {
    id:shot.id,
    duration:shot.duration,
    prompt:shot.generationPrompt,
    dialogue:shot.dialogue,
    actors:shot.actors,
    focusActor:shot.focusActor,
    emotion:shot.emotion,
    shotSize:shot.shotSize,
    cameraMove:shot.cameraMove,
    transition:shot.transition,
    continuity:shot.continuity,
  };
}

export class MonIAVideoEngine{
  private runner=localStorage.getItem('monia-video-runner')||DEFAULT_RUNNER;
  private renders=new Map<string,MonIAVideoRender>();
  private listeners=new Set<Listener>();

  setRunner(url:string){
    this.runner=url.replace(/\/$/,'');
    localStorage.setItem('monia-video-runner',this.runner);
  }
  getRunner(){return this.runner}
  observe(fn:Listener){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  get(id:string){return this.renders.get(id)||null}
  private emit(render:MonIAVideoRender){this.renders.set(render.id,render);this.listeners.forEach(fn=>fn(render))}

  async health(){
    try{
      const r=await fetch(`${this.runner}/health`,{signal:AbortSignal.timeout(1800)});
      return r.ok ? await r.json() : null;
    }catch{return null}
  }

  async render(plan:MonIADramaPlan):Promise<MonIAVideoRender>{
    const id=renderId();
    const initial:MonIAVideoRender={id,state:'queued',jobs:plan.shots.map(s=>({id:`${id}-${s.id}`,shotId:s.id,state:'queued',progress:0}))};
    this.emit(initial);
    const online=await this.health();
    if(!online){
      const offline={...initial,state:'runner-offline' as const,error:'MonIA Video Runner local indisponible.'};
      this.emit(offline);
      return offline;
    }
    try{
      const r=await fetch(`${this.runner}/render`,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({renderId:id,plan:{title:plan.title,format:plan.format,targetDuration:plan.targetDuration,rhythm:plan.rhythm,location:plan.location,continuityAnchor:plan.continuityAnchor,shots:plan.shots.map(shotPayload),voiceLines:plan.voiceLines}}),
      });
      if(!r.ok)throw new Error(`Runner HTTP ${r.status}`);
      const accepted=await r.json();
      const rendering={...initial,state:'rendering' as const,error:undefined};
      this.emit(rendering);
      void this.poll(id,String(accepted.renderId||id));
      return rendering;
    }catch(error){
      const failed={...initial,state:'error' as const,error:error instanceof Error?error.message:String(error)};
      this.emit(failed);
      return failed;
    }
  }

  private async poll(localId:string,remoteId:string){
    for(let i=0;i<720;i++){
      await new Promise(r=>setTimeout(r,2500));
      try{
        const response=await fetch(`${this.runner}/render/${encodeURIComponent(remoteId)}`);
        if(!response.ok)continue;
        const data=await response.json();
        const current=this.renders.get(localId);
        if(!current)return;
        const jobs=current.jobs.map(job=>{
          const remote=(data.jobs||[]).find((j:any)=>j.shotId===job.shotId);
          return remote?{...job,state:remote.state||job.state,progress:Number(remote.progress||0),clipUrl:remote.clipUrl||job.clipUrl,error:remote.error||job.error}:job;
        });
        const next:MonIAVideoRender={...current,state:data.state||current.state,jobs,finalUrl:data.finalUrl||current.finalUrl,error:data.error||current.error};
        this.emit(next);
        if(next.state==='ready'||next.state==='error')return;
      }catch{/* runner may briefly restart */}
    }
    const current=this.renders.get(localId);
    if(current)this.emit({...current,state:'error',error:'Délai de rendu dépassé.'});
  }
}

export const moniaVideo=new MonIAVideoEngine();
