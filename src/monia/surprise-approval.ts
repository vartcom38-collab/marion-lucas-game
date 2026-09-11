export type SurpriseTrustDomain=
  |'lucas-identity'
  |'marion-identity'
  |'duo-identity'
  |'motion-language'
  |'scene-continuity'
  |'assembled-video';

export type SurpriseTrustState={
  mode:'calibration'|'surprise';
  trusted:Record<SurpriseTrustDomain,boolean>;
  updatedAt:number;
};

export type SurpriseCandidateFacts={
  route:string;
  completeAssembly:boolean;
  lucasIdentity:boolean;
  marionIdentity:boolean;
  continuity:boolean;
  wardrobe:boolean;
  location:boolean;
  motion:boolean;
  canon:boolean;
  qualityVerified?:boolean;
  usesNewIdentityMethod?:boolean;
  usesNewVoiceIdentity?:boolean;
  usesNewIntimateGrammar?:boolean;
  usesNewFamilyGrammar?:boolean;
  usesNewBackendBehavior?:boolean;
};

const KEY='monia-surprise-trust-v1';
const DOMAINS:SurpriseTrustDomain[]=['lucas-identity','marion-identity','duo-identity','motion-language','scene-continuity','assembled-video'];

function defaultState():SurpriseTrustState{
  return{mode:'calibration',trusted:{
    'lucas-identity':true,
    'marion-identity':false,
    'duo-identity':false,
    'motion-language':false,
    'scene-continuity':false,
    'assembled-video':false,
  },updatedAt:Date.now()};
}

export function readSurpriseTrust():SurpriseTrustState{
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return defaultState();
    const parsed=JSON.parse(raw) as Partial<SurpriseTrustState>;
    const fallback=defaultState();
    const trusted={...fallback.trusted,...(parsed.trusted||{})};
    const allTrusted=DOMAINS.every(k=>Boolean(trusted[k]));
    return{mode:parsed.mode==='surprise'&&allTrusted?'surprise':'calibration',trusted,updatedAt:Number(parsed.updatedAt||Date.now())};
  }catch{return defaultState()}
}

function writeSurpriseTrust(state:SurpriseTrustState){
  try{localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new CustomEvent('monia:surprise-trust',{detail:state}))}catch{/* optional */}
}

export function trustSurpriseDomain(domain:SurpriseTrustDomain,trusted=true){
  const state=readSurpriseTrust();
  state.trusted[domain]=trusted;
  state.updatedAt=Date.now();
  if(!DOMAINS.every(k=>Boolean(state.trusted[k])))state.mode='calibration';
  writeSurpriseTrust(state);
  return state;
}

export function activateSurpriseMode(){
  const state=readSurpriseTrust();
  const missing=DOMAINS.filter(k=>!state.trusted[k]);
  if(missing.length)throw new Error(`Surprise mode blocked; untrusted domains: ${missing.join(', ')}`);
  state.mode='surprise';state.updatedAt=Date.now();writeSurpriseTrust(state);return state;
}

export function deactivateSurpriseMode(){const state=readSurpriseTrust();state.mode='calibration';state.updatedAt=Date.now();writeSurpriseTrust(state);return state}

function routeRequirements(route:string){
  const r=route.toLowerCase();
  const duo=r.includes('couple')||r.includes('family')||r.includes('duo');
  const lucas=r.includes('lucas')||duo||r.includes('visio');
  const marion=r.includes('marion')||duo;
  return{duo,lucas,marion};
}

export function learnSurpriseTrustFromHumanApproval(candidate:SurpriseCandidateFacts){
  const state=readSurpriseTrust();
  const req=routeRequirements(candidate.route);
  if(req.lucas&&candidate.lucasIdentity)state.trusted['lucas-identity']=true;
  if(req.marion&&candidate.marionIdentity)state.trusted['marion-identity']=true;
  if(req.duo&&candidate.lucasIdentity&&candidate.marionIdentity)state.trusted['duo-identity']=true;
  if(candidate.motion)state.trusted['motion-language']=true;
  if(candidate.continuity&&candidate.wardrobe&&candidate.location)state.trusted['scene-continuity']=true;
  if(candidate.completeAssembly&&candidate.canon)state.trusted['assembled-video']=true;
  if(DOMAINS.every(k=>Boolean(state.trusted[k])))state.mode='surprise';
  state.updatedAt=Date.now();
  writeSurpriseTrust(state);
  window.dispatchEvent(new CustomEvent('monia:surprise-calibration-learned',{detail:{route:candidate.route,state}}));
  return state;
}

export function surpriseGate(candidate:SurpriseCandidateFacts){
  const state=readSurpriseTrust();
  const req=routeRequirements(candidate.route);
  const newDomain=Boolean(candidate.usesNewIdentityMethod||candidate.usesNewVoiceIdentity||candidate.usesNewIntimateGrammar||candidate.usesNewFamilyGrammar||candidate.usesNewBackendBehavior);
  const identitiesOk=(!req.lucas||candidate.lucasIdentity)&&(!req.marion||candidate.marionIdentity);
  const allChecks=Boolean(candidate.qualityVerified!==false&&candidate.completeAssembly&&identitiesOk&&candidate.continuity&&candidate.wardrobe&&candidate.location&&candidate.motion&&candidate.canon);
  const trustOk=Boolean(
    (!req.lucas||state.trusted['lucas-identity'])&&
    (!req.marion||state.trusted['marion-identity'])&&
    (!req.duo||state.trusted['duo-identity'])&&
    state.trusted['motion-language']&&
    state.trusted['scene-continuity']&&
    state.trusted['assembled-video']
  );
  if(state.mode!=='surprise')return{decision:'human-review' as const,reason:'calibration-mode',state};
  if(!trustOk)return{decision:'human-review' as const,reason:'route-domain-not-trusted',state};
  if(newDomain)return{decision:'human-review' as const,reason:'new-untrusted-domain',state};
  if(!allChecks)return{decision:'human-review' as const,reason:'quality-gate-failed',state};
  return{decision:'monia-approved' as const,reason:'trusted-domain-quality-gate-passed',state};
}

declare global{
  interface Window{
    __moniaSurpriseTrust?:()=>SurpriseTrustState;
    __moniaTrustSurpriseDomain?:(domain:SurpriseTrustDomain,trusted?:boolean)=>SurpriseTrustState;
    __moniaActivateSurpriseMode?:()=>SurpriseTrustState;
    __moniaDeactivateSurpriseMode?:()=>SurpriseTrustState;
    __moniaLearnSurpriseTrust?:(candidate:SurpriseCandidateFacts)=>SurpriseTrustState;
  }
}
window.__moniaSurpriseTrust=readSurpriseTrust;
window.__moniaTrustSurpriseDomain=trustSurpriseDomain;
window.__moniaActivateSurpriseMode=activateSurpriseMode;
window.__moniaDeactivateSurpriseMode=deactivateSurpriseMode;
window.__moniaLearnSurpriseTrust=learnSurpriseTrustFromHumanApproval;
