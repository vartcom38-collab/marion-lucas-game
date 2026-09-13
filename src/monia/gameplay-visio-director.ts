import { moniaExperience } from './experience-runtime';
import type { MonIADirectorResult } from './director';
import { getLucasCommunicationPolicy } from './lucas-presence-engine';

const SAVE_KEY='marion-lucas-save-v4';
const VISIO_KEY='monia-last-visio-v1';
const VISIO_MEDIA_KEY='monia-last-visio-media-v1';
const REQUEST_EVENT='marion-lucas:gameplay-visio';
const READY_EVENT='marion-lucas:gameplay-visio-ready';
const MANIFEST_URL='./config/monia-visio-approved.json';

type LooseSave={day?:number;time?:string;place?:string;relationship?:number;trust?:number;chemistry?:number;memories?:string[];eventHistory?:string[];outfit?:string;flags?:Record<string,string|number|boolean>};
export type GameplayVisioRequest={
  source:'gameplay';
  id:string;
  reason:string;
  priority?:'normal'|'important';
  validForMinutes?:number;
  requiredPlace?:string;
  relationshipMin?:number;
  contextHint?:string;
};
export type GameplayVisioReady={request:GameplayVisioRequest;result:MonIADirectorResult;signature:string};

type ApprovedManifest={status?:string;fallback?:string|null;states?:{listening?:string|null;speaking?:string|null;reaction?:string|null;thinking?:string|null}};

let running=false;
let lastPrepared='';
let manifestWarm=false;
let approvedMediaReady=false;
let approvedManifest:ApprovedManifest|null=null;

function readSave():LooseSave|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}}
function relationLabel(value=0){if(value>=70)return'relation très forte et intime';if(value>=45)return'relation proche et solide';if(value>=25)return'relation affectueuse en construction';if(value>=10)return'relation naissante';return'ils se connaissent encore peu'}
function signature(save:LooseSave,request:GameplayVisioRequest){return `${request.id}|${save.day||0}|${save.time||''}|${save.place||''}|${save.relationship||0}|${save.trust||0}|${save.chemistry||0}`}
function valid(save:LooseSave|null,request:GameplayVisioRequest){if(!save)return false;if(request.requiredPlace&&save.place!==request.requiredPlace)return false;if(Number(save.relationship||0)<Number(request.relationshipMin||0))return false;const policy=getLucasCommunicationPolicy();if(policy.mode!=='connect')return false;return true}
function manifestHasApprovedMedia(m:ApprovedManifest){if(m.status!=='locked')return false;const states=m.states||{};return Boolean(m.fallback||states.listening||states.speaking||states.reaction||states.thinking)}
function approvedVideo(){const s=approvedManifest?.states||{};return s.speaking||s.listening||s.reaction||s.thinking||approvedManifest?.fallback||null}

async function warmApprovedMedia(){if(manifestWarm)return approvedMediaReady;manifestWarm=true;try{const r=await fetch(`${MANIFEST_URL}?v=3`,{cache:'no-cache',credentials:'same-origin'});if(!r.ok)return false;const m=await r.json() as ApprovedManifest;approvedManifest=m;approvedMediaReady=manifestHasApprovedMedia(m);if(!approvedMediaReady)console.warn('[Visio Director] no approved Lucas visio media is available yet');return approvedMediaReady}catch(error){console.warn('[Visio Director] manifest prewarm failed',error);return false}}

async function prepare(request:GameplayVisioRequest){
  if(running||request.source!=='gameplay')return;
  const save=readSave();if(!valid(save,request))return;
  if(!await warmApprovedMedia())return;
  const sig=signature(save!,request);if(sig===lastPrepared)return;
  running=true;lastPrepared=sig;
  try{
    const result=await moniaExperience.respond({
      actor:'Lucas',requestedChannel:'visio',
      context:{
        speaker:'Marion',place:save!.place||'unknown',time:save!.time||'00:00',day:Number(save!.day||0),
        recentAction:`Le gameplay autorise maintenant une visio liée à la situation ${request.id}.`,
        activeObjective:'Jouer uniquement la visio décidée par le gameplay, sans inventer un nouvel événement ni révéler de surprise future.',
        relationship:relationLabel(Number(save!.relationship||0)),
        memories:(save!.memories||[]).slice(0,8),recentEvents:(save!.eventHistory||[]).slice(-8),
        rules:[
          'Le gameplay est l’autorité narrative de cet appel.',
          'Ne jamais déclencher une visio de sa propre initiative.',
          'Ne jamais révéler un événement futur ou une surprise.',
          'Lucas reste absolument fidèle.',
          'Répondre comme Lucas dans une vraie visio, pas comme un assistant.',
          'Utiliser uniquement des médias visio explicitement approuvés en production.',
          'Si le contexte gameplay a changé avant l’ouverture, abandonner silencieusement la visio.',
          'Si Lucas est physiquement avec Marion, occupé ou en déplacement, ne pas ouvrir de visio.'
        ],
      },availableMedia:[],
    },'auto',true);
    if(result.response.channel!=='visio')return;
    const current=readSave();if(!valid(current,request)||signature(current!,request)!==sig)return;
    const videoUrl=approvedVideo();if(!approvedMediaReady||!videoUrl)return;
    try{
      sessionStorage.setItem(VISIO_KEY,JSON.stringify(result.response));
      sessionStorage.setItem(VISIO_MEDIA_KEY,JSON.stringify({state:'ready',videoUrl,source:'approved-manifest'}));
    }catch{}
    window.dispatchEvent(new CustomEvent<GameplayVisioReady>(READY_EVENT,{detail:{request,result:result.response,signature:sig}}));
  }catch(error){console.warn('[Visio Director] gameplay visio preparation failed',error)}finally{running=false}
}

window.addEventListener(REQUEST_EVENT,((event:Event)=>{const request=(event as CustomEvent<GameplayVisioRequest>).detail;if(request?.source==='gameplay')void prepare(request)}) as EventListener);

export function requestGameplayVisio(request:Omit<GameplayVisioRequest,'source'>){window.dispatchEvent(new CustomEvent<GameplayVisioRequest>(REQUEST_EVENT,{detail:{...request,source:'gameplay'}}))}
export const GAMEPLAY_VISIO_REQUEST_EVENT=REQUEST_EVENT;
export const GAMEPLAY_VISIO_READY_EVENT=READY_EVENT;

void warmApprovedMedia();
console.info('[Visio Director] approved media handoff + gameplay gating active');
