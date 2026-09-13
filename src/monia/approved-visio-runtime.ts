import approvedManifest from '../../config/monia-visio-approved.json';

export type LucasVisioState='listen'|'talk'|'reaction'|'reflection';
export type ApprovedVisioClip={id:string;src:string;state:LucasVisioState;label:string;loop:boolean;muted:boolean};
type RawClip=Record<string,unknown>;
type V2States={listening?:string|null;speaking?:string|null;reaction?:string|null;thinking?:string|null};
type Manifest={version?:number;character?:string;status?:string;policy?:string;fallback?:string|null;states?:V2States;clips?:RawClip[]};

const manifest=approvedManifest as Manifest;
const VALID_STATES=new Set<LucasVisioState>(['listen','talk','reaction','reflection']);
const STATE_MAP:Record<keyof V2States,LucasVisioState>={listening:'listen',speaking:'talk',reaction:'reaction',thinking:'reflection'};

function stringValue(...values:unknown[]){for(const value of values){if(typeof value==='string'&&value.trim())return value.trim()}return''}
function candidatePath(src:string){return/(^|\/)candidates?(\/|$)/i.test(src)||/candidate-only/i.test(src)}
function safeApprovedSource(src:string){return Boolean(src)&&!candidatePath(src)}
function stateValue(raw:RawClip):LucasVisioState{const rawState=stringValue(raw.state,raw.mode,raw.kind,raw.phase).toLowerCase();return VALID_STATES.has(rawState as LucasVisioState)?rawState as LucasVisioState:'listen'}
function approvedValue(raw:RawClip){if(raw.approved===false||raw.validated===false||raw.status==='rejected'||raw.status==='candidate'||raw.candidateOnly===true)return false;return true}
function normalizeLegacy(raw:RawClip,index:number):ApprovedVisioClip|null{
  if(!approvedValue(raw))return null;
  const src=stringValue(raw.src,raw.path,raw.url,raw.file,raw.asset);if(!safeApprovedSource(src))return null;
  return{id:stringValue(raw.id,raw.slug)||`approved-visio-${index+1}`,src,state:stateValue(raw),label:stringValue(raw.label,raw.title)||'Lucas',loop:raw.loop!==false,muted:raw.muted!==false};
}
function normalizeV2(){
  if(Number(manifest.version||0)<2||manifest.status!=='locked'||manifest.character!=='lucas'||manifest.fallback!==null)return[] as ApprovedVisioClip[];
  const states=manifest.states||{};const clips:ApprovedVisioClip[]=[];
  (Object.keys(STATE_MAP) as Array<keyof V2States>).forEach(key=>{const src=stringValue(states[key]);if(!safeApprovedSource(src))return;clips.push({id:`approved-lucas-${key}`,src,state:STATE_MAP[key],label:'Lucas',loop:true,muted:true})});
  return clips;
}

const V2_CLIPS=normalizeV2();
const LEGACY_CLIPS=V2_CLIPS.length?[]:(Array.isArray(manifest.clips)?manifest.clips:[]).map(normalizeLegacy).filter((clip):clip is ApprovedVisioClip=>Boolean(clip));
const APPROVED_CLIPS=[...V2_CLIPS,...LEGACY_CLIPS];

export function approvedLucasVisioClips(){return APPROVED_CLIPS.slice()}
export function hasApprovedLucasVisio(){return APPROVED_CLIPS.length>0}
export function approvedLucasVisioFor(state:LucasVisioState='listen'){return APPROVED_CLIPS.find(clip=>clip.state===state)||APPROVED_CLIPS.find(clip=>clip.state==='listen')||APPROVED_CLIPS[0]||null}
export function isApprovedLucasVisioSource(src:string){return APPROVED_CLIPS.some(clip=>clip.src===src)}
export function approvedLucasVisioPolicy(){return String(manifest.policy||'Only explicitly approved Lucas visio media may be exposed to gameplay.')}
export function approvedLucasVisioManifestStatus(){return{version:Number(manifest.version||0),status:String(manifest.status||''),locked:manifest.status==='locked',fallback:manifest.fallback??null,count:APPROVED_CLIPS.length}}

console.info(`[Visio] approved-only runtime active (${APPROVED_CLIPS.length} live clip${APPROVED_CLIPS.length===1?'':'s'})`);
