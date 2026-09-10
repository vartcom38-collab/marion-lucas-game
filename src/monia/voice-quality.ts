export type VoiceQualityReport={
  status:'pass'|'reject'|'unknown';
  duration?:number;
  sampleRate?:number;
  rms?:number;
  dynamicRange?:number;
  silenceRatio?:number;
  clippingRatio?:number;
  reasons:string[];
};

function percentile(values:number[],p:number){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.floor((sorted.length-1)*p)))];
}

function analyseChannel(data:Float32Array,sampleRate:number){
  const frame=Math.max(256,Math.floor(sampleRate*0.04));
  const levels:number[]=[];
  let clipped=0,total=0,sumSq=0;
  for(let i=0;i<data.length;i++){
    const v=data[i];sumSq+=v*v;total++;if(Math.abs(v)>=0.985)clipped++;
  }
  for(let i=0;i<data.length;i+=frame){
    let sq=0,n=0;
    for(let j=i;j<Math.min(data.length,i+frame);j++){sq+=data[j]*data[j];n++}
    if(n)levels.push(Math.sqrt(sq/n));
  }
  const silenceRatio=levels.length?levels.filter(v=>v<0.006).length/levels.length:1;
  const p10=percentile(levels,0.10),p90=percentile(levels,0.90);
  return {rms:Math.sqrt(sumSq/Math.max(1,total)),dynamicRange:p90-p10,silenceRatio,clippingRatio:clipped/Math.max(1,total)};
}

export async function inspectVoiceAudio(url:string):Promise<VoiceQualityReport>{
  try{
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const bytes=await response.arrayBuffer();
    const Ctx=window.AudioContext||(window as any).webkitAudioContext;
    if(!Ctx)return {status:'unknown',reasons:['Web Audio indisponible']};
    const ctx=new Ctx();
    try{
      const audio=await ctx.decodeAudioData(bytes.slice(0));
      const duration=audio.duration,sampleRate=audio.sampleRate;
      if(!audio.numberOfChannels||duration<=0)return {status:'reject',duration,sampleRate,reasons:['audio vide ou indécodable']};
      const metrics=analyseChannel(audio.getChannelData(0),sampleRate);
      const reasons:string[]=[];
      if(duration<0.35)reasons.push('audio beaucoup trop court');
      if(duration>45)reasons.push('audio anormalement long pour une réplique');
      if(metrics.rms<0.003)reasons.push('niveau audio quasi nul');
      if(metrics.clippingRatio>0.02)reasons.push('écrêtage audio excessif');
      if(metrics.silenceRatio>0.72)reasons.push('trop de silence ou de coupures');
      return {status:reasons.length?'reject':'pass',duration,sampleRate,...metrics,reasons};
    }finally{void ctx.close()}
  }catch(error){
    return {status:'unknown',reasons:[error instanceof Error?error.message:String(error)]};
  }
}

export function voiceQualitySummary(report:VoiceQualityReport){
  if(report.status==='reject')return `Voix rejetée automatiquement · ${report.reasons.join(' · ')}`;
  if(report.status==='pass')return 'Voix techniquement saine · identité du locuteur et naturel restent soumis aux contrôles MonIA';
  return 'Contrôle voix automatique indisponible · aucun score de naturel ou d’identité n’est inventé';
}
