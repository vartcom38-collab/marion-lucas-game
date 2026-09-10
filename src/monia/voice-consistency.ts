export type VoiceFingerprint={
  duration:number;
  rms:number;
  zeroCrossingRate:number;
  pitchMedian?:number;
  pitchSpread?:number;
  voicedRatio:number;
  cadenceVariance:number;
};

export type VoiceConsistencyReport={
  status:'consistent'|'hold'|'unknown';
  score?:number;
  baselineAvailable:boolean;
  fingerprint?:VoiceFingerprint;
  baseline?:VoiceFingerprint;
  reasons:string[];
};

const BASELINE_KEY='monia-lucas-voice-baseline-v1';

function clamp(v:number,min=0,max=1){return Math.max(min,Math.min(max,v))}
function median(values:number[]){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function percentile(values:number[],p:number){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.max(0,Math.floor((a.length-1)*p)))]}

function estimatePitch(frame:Float32Array,sampleRate:number){
  let energy=0;for(let i=0;i<frame.length;i++)energy+=frame[i]*frame[i];
  if(Math.sqrt(energy/Math.max(1,frame.length))<0.008)return 0;
  const minLag=Math.max(2,Math.floor(sampleRate/320));
  const maxLag=Math.min(frame.length-2,Math.floor(sampleRate/70));
  let bestLag=0,best=-Infinity;
  for(let lag=minLag;lag<=maxLag;lag+=2){
    let sum=0,a=0,b=0;
    for(let i=0;i<frame.length-lag;i+=2){const x=frame[i],y=frame[i+lag];sum+=x*y;a+=x*x;b+=y*y}
    const corr=sum/Math.sqrt(Math.max(1e-9,a*b));
    if(corr>best){best=corr;bestLag=lag}
  }
  return best>0.42&&bestLag?sampleRate/bestLag:0;
}

function fingerprintBuffer(data:Float32Array,sampleRate:number,duration:number):VoiceFingerprint{
  let sq=0,cross=0;
  for(let i=0;i<data.length;i++){const v=data[i];sq+=v*v;if(i&&((v>=0)!=(data[i-1]>=0)))cross++}
  const rms=Math.sqrt(sq/Math.max(1,data.length));
  const zcr=cross/Math.max(1,data.length-1);
  const frame=Math.max(1024,Math.floor(sampleRate*0.08));
  const hop=Math.max(512,Math.floor(frame/2));
  const pitches:number[]=[];const levels:number[]=[];
  for(let start=0;start+frame<data.length;start+=hop){
    const slice=data.subarray(start,start+frame);
    let s=0;for(let i=0;i<slice.length;i++)s+=slice[i]*slice[i];
    levels.push(Math.sqrt(s/slice.length));
    const p=estimatePitch(slice,sampleRate);if(p)pitches.push(p);
  }
  const pitchMedian=pitches.length?median(pitches):undefined;
  const pitchSpread=pitches.length?percentile(pitches,.8)-percentile(pitches,.2):undefined;
  const voicedRatio=levels.length?pitches.length/levels.length:0;
  const mean=levels.reduce((a,b)=>a+b,0)/Math.max(1,levels.length);
  const cadenceVariance=levels.length?Math.sqrt(levels.reduce((a,b)=>a+(b-mean)*(b-mean),0)/levels.length):0;
  return {duration,rms,zeroCrossingRate:zcr,pitchMedian,pitchSpread,voicedRatio,cadenceVariance};
}

async function decode(url:string){
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const bytes=await r.arrayBuffer();const Ctx=window.AudioContext||(window as any).webkitAudioContext;
  if(!Ctx)throw new Error('Web Audio indisponible');const ctx=new Ctx();
  try{const audio=await ctx.decodeAudioData(bytes.slice(0));return fingerprintBuffer(audio.getChannelData(0),audio.sampleRate,audio.duration)}finally{void ctx.close()}
}

export function readLucasVoiceBaseline():VoiceFingerprint|null{
  try{const raw=localStorage.getItem(BASELINE_KEY);return raw?JSON.parse(raw) as VoiceFingerprint:null}catch{return null}
}

export function clearLucasVoiceBaseline(){try{localStorage.removeItem(BASELINE_KEY)}catch{}}

export async function approveLucasVoiceBaseline(url:string){
  const fp=await decode(url);try{localStorage.setItem(BASELINE_KEY,JSON.stringify(fp))}catch{}
  return fp;
}

function relative(a:number,b:number,floor=.001){return Math.abs(a-b)/Math.max(floor,Math.abs(b))}

export async function inspectLucasVoiceConsistency(url:string):Promise<VoiceConsistencyReport>{
  try{
    const fingerprint=await decode(url),baseline=readLucasVoiceBaseline();
    if(!baseline)return {status:'unknown',baselineAvailable:false,fingerprint,reasons:['aucune voix Lucas validée n’est encore définie comme référence acoustique']};
    const deltas:number[]=[];const reasons:string[]=[];
    deltas.push(clamp(relative(fingerprint.zeroCrossingRate,baseline.zeroCrossingRate,.005)));
    deltas.push(clamp(relative(fingerprint.voicedRatio,baseline.voicedRatio,.15)));
    deltas.push(clamp(relative(fingerprint.cadenceVariance,baseline.cadenceVariance,.005)));
    if(fingerprint.pitchMedian&&baseline.pitchMedian){
      const d=clamp(Math.abs(Math.log2(fingerprint.pitchMedian/baseline.pitchMedian))/0.55);deltas.push(d);
      if(d>.7)reasons.push('hauteur vocale très éloignée de la référence validée');
    }
    if(fingerprint.pitchSpread!=null&&baseline.pitchSpread!=null)deltas.push(clamp(relative(fingerprint.pitchSpread,baseline.pitchSpread,15)));
    const drift=deltas.reduce((a,b)=>a+b,0)/Math.max(1,deltas.length);
    const score=clamp(1-drift);
    if(relative(fingerprint.zeroCrossingRate,baseline.zeroCrossingRate,.005)>.9)reasons.push('texture acoustique grossièrement différente');
    if(relative(fingerprint.voicedRatio,baseline.voicedRatio,.15)>.8)reasons.push('structure voix/silence très différente');
    const status=score<.48||reasons.length>=2?'hold':'consistent';
    if(status==='hold'&&!reasons.length)reasons.push('empreinte acoustique trop éloignée de la référence Lucas validée');
    return {status,score,baselineAvailable:true,fingerprint,baseline,reasons};
  }catch(error){return {status:'unknown',baselineAvailable:Boolean(readLucasVoiceBaseline()),reasons:[error instanceof Error?error.message:String(error)]}}
}

export function voiceConsistencySummary(report:VoiceConsistencyReport){
  if(report.status==='hold')return `Voix mise en attente · ${report.reasons.join(' · ')}`;
  if(report.status==='consistent')return `Empreinte acoustique cohérente (${Math.round((report.score||0)*100)} %) · ce score ne prouve pas à lui seul l’identité du locuteur`;
  return 'Cohérence de timbre non mesurable pour le moment · validation humaine conservée';
}
