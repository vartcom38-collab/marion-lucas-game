import approvedManifest from '../../config/monia-visio-approved.json';

export type LucasVisioState='listen'|'talk'|'reaction'|'reflection';
export type ApprovedVisioClip={
  id:string;
  src:string;
  state:LucasVisioState;
  label:string;
  loop:boolean;
  muted:boolean;
};

type RawClip=Record<string,unknown>;
type Manifest={version?:number;policy?:string;clips?:RawClip[]};

const manifest=approvedManifest as Manifest;
const VALID_STATES=new Set<LucasVisioState>(['listen','talk','reaction','reflection']);

function stringValue(...values:unknown[]){for(const value of values){if(typeof value==='string'&&value.trim())return value.trim()}return''}
function stateValue(raw:RawClip):LucasVisioState{
  const rawState=stringValue(raw.state,raw.mode,raw.kind,raw.phase).toLowerCase();
  return VALID_STATES.has(rawState as LucasVisioState)?rawState as LucasVisioState:'listen';
}
function candidatePath(src:string){return/(^|\/)candidates?(\/|$)/i.test(src)||/candidate-only/i.test(src)}
function approvedValue(raw:RawClip){
  if(raw.approved===false||raw.validated===false||raw.status==='rejected'||raw.status==='candidate'||raw.candidateOnly===true)return false;
  return true;
}
function normalize(raw:RawClip,index:number):ApprovedVisioClip|null{
  if(!approvedValue(raw))return null;
  const src=stringValue(raw.src,raw.path,raw.url,raw.file,raw.asset);
  if(!src||candidatePath(src))return null;
  return{
    id:stringValue(raw.id,raw.slug)||`approved-visio-${index+1}`,
    src,
    state:stateValue(raw),
    label:stringValue(raw.label,raw.title)||'Lucas',
    loop:raw.loop!==false,
    muted:raw.muted!==false,
  };
}

const APPROVED_CLIPS=(Array.isArray(manifest.clips)?manifest.clips:[]).map(normalize).filter((clip):clip is ApprovedVisioClip=>Boolean(clip));

export function approvedLucasVisioClips(){return APPROVED_CLIPS.slice()}
export function hasApprovedLucasVisio(){return APPROVED_CLIPS.length>0}
export function approvedLucasVisioFor(state:LucasVisioState='listen'){
  return APPROVED_CLIPS.find(clip=>clip.state===state)||APPROVED_CLIPS.find(clip=>clip.state==='listen')||APPROVED_CLIPS[0]||null;
}
export function approvedLucasVisioPolicy(){return String(manifest.policy||'Only explicitly approved Lucas visio media may be exposed to gameplay.')}

console.info(`[Visio] approved-only runtime active (${APPROVED_CLIPS.length} live clip${APPROVED_CLIPS.length===1?'':'s'})`);
