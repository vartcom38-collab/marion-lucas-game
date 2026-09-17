import type { MonIAGenerationJob } from './generation-job';
import { requestLucasV16, LUCAS_V16_READY_EVENT, type LucasV16Ready } from './v16-runtime-bridge';

const JOB_EVENT='marion-lucas:monia-generation-job';
const STATE_EVENT='marion-lucas:monia-generation-state';
const ACTIVE_KEY='monia-generation-active-v1';

export type MonIAGenerationState={
  jobId:string;
  phase:'queued'|'voice-requested'|'voice-ready'|'storyboard-ready'|'visual-ready'|'sync-ready'|'validated'|'ready'|'failed';
  detail?:string;
  voice?:{audioUrl:string;duration:number;text:string};
  updatedAt:number;
};

function saveState(state:MonIAGenerationState){
  try{sessionStorage.setItem(ACTIVE_KEY,JSON.stringify(state))}catch{}
  window.dispatchEvent(new CustomEvent<MonIAGenerationState>(STATE_EVENT,{detail:state}));
}

function intentFor(job:MonIAGenerationJob){
  const value=(job.shots[0]?.emotion||'').toLowerCase();
  if(/tender|intim/.test(value))return'tender' as const;
  if(/warm|affect/.test(value))return'warm' as const;
  if(/worried|concern/.test(value))return'concerned' as const;
  if(/tired|fatigu/.test(value))return'tired' as const;
  if(/playful|amused|taquin/.test(value))return'amused' as const;
  return'neutral' as const;
}

function firstLucasLine(job:MonIAGenerationJob){
  for(const shot of job.shots){
    const line=shot.dialogue?.find(item=>item.actor==='Lucas'&&item.voice==='lucas-v16-direct-design');
    if(line?.text.trim())return line.text.trim();
  }
  return'';
}

function retimeFromVoice(job:MonIAGenerationJob,duration:number){
  if(!Number.isFinite(duration)||duration<=0)return job;
  const shots=job.shots.map(shot=>({...shot}));
  const speaking=shots.find(shot=>shot.dialogue?.some(item=>item.actor==='Lucas'));
  if(speaking)speaking.durationHint=Math.max(1,Math.round(duration*100)/100);
  return {...job,shots};
}

export async function executeMonIAGenerationJob(job:MonIAGenerationJob){
  saveState({jobId:job.id,phase:'queued',updatedAt:Date.now()});
  const text=firstLucasLine(job);
  if(!text){
    saveState({jobId:job.id,phase:'storyboard-ready',detail:'No Lucas speech; visual generation may proceed.',updatedAt:Date.now()});
    window.dispatchEvent(new CustomEvent(JOB_EVENT,{detail:{job}}));
    return job;
  }

  const request=requestLucasV16(text,intentFor(job),job.id);
  saveState({jobId:job.id,phase:'voice-requested',detail:request.id,updatedAt:Date.now()});

  return await new Promise<MonIAGenerationJob>((resolve,reject)=>{
    const timeout=window.setTimeout(()=>{
      window.removeEventListener(LUCAS_V16_READY_EVENT,onReady as EventListener);
      const error=new Error(`V16 runtime render timed out for ${job.id}`);
      saveState({jobId:job.id,phase:'failed',detail:error.message,updatedAt:Date.now()});
      reject(error);
    },120000);

    const onReady=(event:Event)=>{
      const ready=(event as CustomEvent<LucasV16Ready>).detail;
      if(!ready||ready.id!==request.id||ready.sceneJobId!==job.id)return;
      window.clearTimeout(timeout);
      window.removeEventListener(LUCAS_V16_READY_EVENT,onReady as EventListener);
      if(ready.text.trim()!==text){
        const error=new Error('V16 exact-dialogue validation failed');
        saveState({jobId:job.id,phase:'failed',detail:error.message,updatedAt:Date.now()});
        reject(error);return;
      }
      const retimed=retimeFromVoice(job,ready.duration);
      saveState({jobId:job.id,phase:'voice-ready',voice:{audioUrl:ready.audioUrl,duration:ready.duration,text:ready.text},updatedAt:Date.now()});
      saveState({jobId:job.id,phase:'storyboard-ready',detail:'Visual generation may now use V16 duration as timing authority.',voice:{audioUrl:ready.audioUrl,duration:ready.duration,text:ready.text},updatedAt:Date.now()});
      window.dispatchEvent(new CustomEvent(JOB_EVENT,{detail:{job:retimed,voice:ready}}));
      resolve(retimed);
    };
    window.addEventListener(LUCAS_V16_READY_EVENT,onReady as EventListener);
  });
}

export function dispatchMonIAGenerationJob(job:MonIAGenerationJob){void executeMonIAGenerationJob(job).catch(error=>console.error('[MonIA generation executor]',error));}
export const MONIA_GENERATION_JOB_EVENT=JOB_EVENT;
export const MONIA_GENERATION_STATE_EVENT=STATE_EVENT;

console.info('[MonIA] Unified generation executor active · voice first, V16 timing authority, fail closed');
