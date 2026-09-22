import type {MoniaWorldState} from './monia-world-state';

export type DirectorCandidate={
 id:string; kind:'ordinary'|'social'|'encounter'|'phone'|'transition'|'night';
 sceneId:string; label:string; minMinute:number; maxMinute:number;
 requiresOutside?:boolean; requiresMetDominic?:boolean; forbidsMetDominic?:boolean;
 participants:string[]; camera:string[]; durationMinutes:[number,number]; baseWeight:number;
 staging?:Record<string,{screenSide?:'left'|'center'|'right';posture?:string;gazeTarget?:string;gesture?:string;emotion?:string;distance?:string}>;
};
export type DirectorDecision={candidate:DirectorCandidate;score:number;reason:string;prefetch:string[]};

const minute=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m};
const seeded=(seed:number,key:string)=>{let x=seed;for(let i=0;i<key.length;i++)x=(x*31+key.charCodeAt(i))>>>0;return (x%10000)/10000};

const DAY1:DirectorCandidate[]=[
{id:'home-life',kind:'ordinary',sceneId:'D1_MORNING_HOME',label:'Continuer la matinée chez Marion',minMinute:552,maxMinute:650,participants:['Marion'],camera:['cinematic-single-character','environmental'],durationMinutes:[6,18],baseWeight:8},
{id:'city-walk',kind:'ordinary',sceneId:'D1_MORNING_CITY',label:'Vivre un moment ordinaire en ville',minMinute:575,maxMinute:900,requiresOutside:true,participants:['Marion'],camera:['POV-Marion','cinematic-single-character','environmental'],durationMinutes:[5,20],baseWeight:10},
{id:'marine-social',kind:'social',sceneId:'D1_MARINE_MEET',label:'Croiser ou retrouver Marine',minMinute:590,maxMinute:1120,requiresOutside:true,participants:['Marion','Marine'],camera:['cinematic-two-character','over-shoulder'],durationMinutes:[10,35],baseWeight:5},
{id:'dominic-first',kind:'encounter',sceneId:'D1_FIRST_ENCOUNTER',label:'Première rencontre avec Dominic',minMinute:600,maxMinute:930,requiresOutside:true,forbidsMetDominic:true,participants:['Marion','Dominic'],camera:['cinematic-two-character','over-shoulder','POV-Marion'],durationMinutes:[5,20],baseWeight:2,staging:{Marion:{screenSide:'left',posture:'natural, slightly reserved',gazeTarget:'Dominic then briefly away',gesture:'small restrained hand movement',emotion:'curious, alert, not instantly romantic',distance:'social conversational distance'},Dominic:{screenSide:'right',posture:'relaxed upright presence',gazeTarget:'Marion with natural breaks',gesture:'minimal confident micro-gestures',emotion:'attentive, intrigued, composed',distance:'social conversational distance'}}},
{id:'post-encounter-life',kind:'ordinary',sceneId:'D1_AFTERNOON',label:'Continuer la journée après la rencontre',minMinute:720,maxMinute:1110,requiresOutside:true,requiresMetDominic:true,participants:['Marion'],camera:['cinematic-single-character','environmental'],durationMinutes:[10,30],baseWeight:9},
{id:'evening',kind:'transition',sceneId:'D1_EVENING',label:'Entrer dans la soirée',minMinute:1080,maxMinute:1350,participants:['Marion'],camera:['cinematic-single-character','environmental'],durationMinutes:[10,30],baseWeight:10},
{id:'night',kind:'night',sceneId:'D1_NIGHT',label:'Finir la journée',minMinute:1290,maxMinute:1439,participants:['Marion'],camera:['cinematic-single-character'],durationMinutes:[10,30],baseWeight:10}
];

const outside=(w:MoniaWorldState)=>!String(w.marion.location||'').toLowerCase().includes('chez marion');
const eligible=(w:MoniaWorldState,c:DirectorCandidate)=>{
 const now=minute(w.clock.time);
 if(now<c.minMinute||now>c.maxMinute)return false;
 if(c.requiresOutside&&!outside(w))return false;
 if(c.requiresMetDominic&&!w.dominic.met)return false;
 if(c.forbidsMetDominic&&w.dominic.met)return false;
 return true;
};
const score=(w:MoniaWorldState,c:DirectorCandidate)=>{
 let s=c.baseWeight+seeded(w.seed,c.id+':'+w.clock.time)*3;
 const now=minute(w.clock.time);
 if(c.id==='dominic-first'&&!w.dominic.met){
   // Day-1 invariant: encounter must resolve by 15:30, without teleporting Dominic into Marion's home.
   if(outside(w))s+=Math.max(0,(now-660)/20);
   if(now>=870&&outside(w))s+=50;
 }
 if(w.runtime.sceneId===c.sceneId)s-=5;
 if(w.continuity.sharedEvents.slice(0,4).includes(c.id))s-=8;
 return s;
};
export const directNextBeat=(w:MoniaWorldState):DirectorDecision=>{
 let pool=DAY1.filter(c=>eligible(w,c));
 const now=minute(w.clock.time);
 if(w.clock.dayIndex===1&&!w.dominic.met&&now>=900&&outside(w)){
   const forced=DAY1.find(c=>c.id==='dominic-first')!;
   pool=[forced];
 }
 if(!pool.length){
   const fallback:DirectorCandidate={id:'continuity',kind:'ordinary',sceneId:w.runtime.sceneId||'D1_MORNING_HOME',label:'Continuer naturellement',minMinute:0,maxMinute:1439,participants:['Marion'],camera:['cinematic-single-character','environmental'],durationMinutes:[5,15],baseWeight:1};
   return {candidate:fallback,score:1,reason:'No authored event eligible; preserve lived continuity.',prefetch:[]};
 }
 const ranked=pool.map(c=>({c,s:score(w,c)})).sort((a,b)=>b.s-a.s);
 const pick=ranked[0];
 return {candidate:pick.c,score:pick.s,reason:pick.c.id==='dominic-first'?'Day-1 encounter eligible from route, time and continuity.':'Best eligible lived-world beat.',prefetch:ranked.slice(1,4).map(x=>x.c.id)};
};
export const applyDirectorDecision=(w:MoniaWorldState,d:DirectorDecision)=>{
 w.runtime.sceneId=d.candidate.sceneId;w.runtime.beatId=d.candidate.id;w.runtime.prefetch=d.prefetch;
 if(!w.continuity.sharedEvents.includes(d.candidate.id))w.continuity.sharedEvents.unshift(d.candidate.id);
 return w;
};
export const buildVideoRequest=(w:MoniaWorldState,d:DirectorDecision)=>({
 schema:'monia-video-request-v3',runId:w.runId,sceneId:d.candidate.sceneId,beatId:d.candidate.id,
 story:{day:w.clock.dayIndex,time:w.clock.time,phase:w.clock.phase,location:w.marion.location},
 characters:d.candidate.participants.map(name=>({name,outfitId:name==='Marion'?w.marion.outfitId:w.dominic.outfitId,canonicalIdentityRequired:true})),
 cameraCandidates:d.candidate.camera,durationTargetSeconds:[4,12],
 staging:{characters:d.candidate.participants.map(name=>({name,...(d.candidate.staging?.[name]||{posture:'natural lived posture',gazeTarget:'contextual',gesture:'subtle natural micro-movement',emotion:'contextual'})})),interaction:d.candidate.participants.length>1?'preserve believable interpersonal distance, eyelines and independent body language':'natural solo lived action'},
 continuity:{token:w.runtime.continuityToken||null,location:w.marion.location,outfitMarion:w.marion.outfitId,outfitDominic:w.dominic.outfitId},
 quality:{candidateOnly:true,requireIdentity:true,requireEyeStability:true,requireTemporalStability:true,requireWardrobeContinuity:true},
 prefetch:d.prefetch
});
