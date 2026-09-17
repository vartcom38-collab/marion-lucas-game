import { moniaExperience } from './experience-runtime';
import type { MonIADirectorResult } from './director';
import { getLucasCommunicationPolicy } from './lucas-presence-engine';
import { approvedLucasVisioFor, hasApprovedLucasVisio, isApprovedLucasVisioSource } from './approved-visio-runtime';

const SAVE_KEY='marion-lucas-save-v4';
const VISIO_KEY='monia-last-visio-v1';
const VISIO_MEDIA_KEY='monia-last-visio-media-v1';
const REQUEST_EVENT='marion-lucas:gameplay-visio';
const READY_EVENT='marion-lucas:gameplay-visio-ready';
const BASE='https://marion-lucas.marionbolomey.fr/resources/monia/generated/';

const SURPRISE_V5={
  listening:`${BASE}visio-lucas-surprise-v5-monia-listening-candidate.mp4`,
  speaking:`${BASE}visio-lucas-surprise-v5-monia-speaking-v16-candidate.mp4`,
  reaction:`${BASE}visio-lucas-surprise-v5-monia-reaction-candidate.mp4`,
};

type LooseSave={day?:number;time?:string;place?:string;relationship?:number;trust?:number;chemistry?:number;memories?:string[];eventHistory?:string[];outfit?:string;flags?:Record<string,string|number|boolean>};
export type GameplayVisioRequest={source:'gameplay';id:string;reason:string;priority?:'normal'|'important';validForMinutes?:number;requiredPlace?:string;relationshipMin?:number;contextHint?:string;mode?:'normal'|'surprise'};
export type GameplayVisioReady={request:GameplayVisioRequest;result:MonIADirectorResult;signature:string};
export type GameplayVisioMediaTicket={
  state:'ready';
  videoUrl:string;
  source:'approved-manifest'|'monia-transient-candidate';
  requestId:string;
  signature:string;
  authorizedAt:number;
  expiresAt:number;
  stateMedia?:{listening?:string;speaking?:string;reaction?:string;thinking?:string};
  canonicalPromotion:false;
};

let running=false;
let lastPrepared='';

function readSave():LooseSave|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}}
function relationLabel(value=0){if(value>=70)return'relation très forte et intime';if(value>=45)return'relation proche et solide';if(value>=25)return'relation affectueuse en construction';if(value>=10)return'relation naissante';return'ils se connaissent encore peu'}
function signature(save:LooseSave,request:GameplayVisioRequest){return `${request.id}|${save.day||0}|${save.time||''}|${save.place||''}|${save.relationship||0}|${save.trust||0}|${save.chemistry||0}`}
function valid(save:LooseSave|null,request:GameplayVisioRequest){if(!save)return false;if(request.requiredPlace&&save.place!==request.requiredPlace)return false;if(Number(save.relationship||0)<Number(request.relationshipMin||0))return false;const policy=getLucasCommunicationPolicy();return policy.mode==='connect'}
function clearTicket(){try{sessionStorage.removeItem(VISIO_MEDIA_KEY)}catch{}}
function isSurprise(request:GameplayVisioRequest){return request.mode==='surprise'||/surprise|surprends|spontan/i.test(`${request.id} ${request.reason} ${request.contextHint||''}`)}
function safeGeneratedUrl(url:string){return url.startsWith(BASE)&&url.includes('visio-lucas-surprise-v5-monia-')&&url.endsWith('-candidate.mp4')}

async function urlUsable(url:string){
  try{const r=await fetch(url,{method:'HEAD',cache:'no-store'});return r.ok}catch{return false}
}

async function transientSurprisePack(){
  const pairs=await Promise.all(Object.entries(SURPRISE_V5).map(async([key,url])=>[key,await urlUsable(url)?url:''] as const));
  const stateMedia=Object.fromEntries(pairs.filter(([,url])=>url));
  return stateMedia as GameplayVisioMediaTicket['stateMedia'];
}

async function prepare(request:GameplayVisioRequest){
  if(running||request.source!=='gameplay')return;
  clearTicket();
  const save=readSave();if(!valid(save,request))return;
  const sig=signature(save!,request);if(sig===lastPrepared)return;
  running=true;lastPrepared=sig;
  try{
    const surprise=isSurprise(request);
    const transient=surprise?await transientSurprisePack():undefined;
    const generatedReady=Boolean(transient?.listening&&transient?.speaking&&transient?.reaction);
    const approved=hasApprovedLucasVisio()?(approvedLucasVisioFor('talk')||approvedLucasVisioFor('listen')):null;
    if(!generatedReady&&(!approved||!isApprovedLucasVisioSource(approved.src))){
      console.warn('[Visio Director] no validated transient pack or approved Lucas visio media is available');
      return;
    }

    const result=await moniaExperience.respond({
      actor:'Lucas',requestedChannel:'visio',
      context:{
        speaker:'Marion',place:save!.place||'unknown',time:save!.time||'00:00',day:Number(save!.day||0),
        recentAction:surprise?`MonIA prépare une visio surprise cohérente avec la situation ${request.id}.`:`Le gameplay autorise maintenant une visio liée à la situation ${request.id}.`,
        activeObjective:surprise?'Créer un appel spontané crédible de Lucas, sans spoiler la suite et sans contredire son agenda.':'Jouer uniquement la visio décidée par le gameplay, sans inventer un événement futur.',
        relationship:relationLabel(Number(save!.relationship||0)),
        memories:(save!.memories||[]).slice(0,8),recentEvents:(save!.eventHistory||[]).slice(-8),
        rules:[
          'Le gameplay et MonIA décident ensemble si cet appel est cohérent maintenant.',
          'Ne jamais révéler un événement futur ou une surprise planifiée.',
          'Lucas reste absolument fidèle.',
          'Répondre comme Lucas dans une vraie visio, pas comme un assistant.',
          'Respecter le lieu, l’heure, la relation, l’agenda et les événements récents.',
          'Une génération validée peut être utilisée pour cet appel sans devenir une référence canon.',
          'Ne jamais promouvoir automatiquement un candidat généré dans la banque de références.',
          'Si Lucas est physiquement avec Marion, occupé ou indisponible, abandonner silencieusement la visio.'
        ],
      },availableMedia:[],
    },'auto',true);
    if(result.response.channel!=='visio')return;
    const current=readSave();if(!valid(current,request)||signature(current!,request)!==sig)return;

    const authorizedAt=Date.now();
    const validForMinutes=Math.max(1,Math.min(30,Number(request.validForMinutes||8)));
    const source:GameplayVisioMediaTicket['source']=generatedReady?'monia-transient-candidate':'approved-manifest';
    const videoUrl=generatedReady?transient!.listening!:(approvedLucasVisioFor('talk')||approvedLucasVisioFor('listen'))!.src;
    const ticket:GameplayVisioMediaTicket={state:'ready',videoUrl,source,requestId:request.id,signature:sig,authorizedAt,expiresAt:authorizedAt+validForMinutes*60_000,stateMedia:generatedReady?transient:undefined,canonicalPromotion:false};
    try{sessionStorage.setItem(VISIO_KEY,JSON.stringify(result.response));sessionStorage.setItem(VISIO_MEDIA_KEY,JSON.stringify(ticket))}catch{}
    window.dispatchEvent(new CustomEvent<GameplayVisioReady>(READY_EVENT,{detail:{request,result:result.response,signature:sig}}));
  }catch(error){console.warn('[Visio Director] gameplay visio preparation failed',error);clearTicket()}finally{running=false}
}

window.addEventListener(REQUEST_EVENT,((event:Event)=>{const request=(event as CustomEvent<GameplayVisioRequest>).detail;if(request?.source==='gameplay')void prepare(request)}) as EventListener);

export function requestGameplayVisio(request:Omit<GameplayVisioRequest,'source'>){window.dispatchEvent(new CustomEvent<GameplayVisioRequest>(REQUEST_EVENT,{detail:{...request,source:'gameplay'}}))}
export function requestSurpriseVisio(request:Omit<GameplayVisioRequest,'source'|'mode'>){requestGameplayVisio({...request,mode:'surprise'})}
export function readGameplayVisioTicket():GameplayVisioMediaTicket|null{try{const raw=sessionStorage.getItem(VISIO_MEDIA_KEY);if(!raw)return null;const ticket=JSON.parse(raw) as GameplayVisioMediaTicket;if(ticket.state!=='ready'||!ticket.requestId||!ticket.signature||Date.now()>=Number(ticket.expiresAt||0)){clearTicket();return null}if(ticket.source==='approved-manifest'&&!isApprovedLucasVisioSource(ticket.videoUrl)){clearTicket();return null}if(ticket.source==='monia-transient-candidate'&&(!safeGeneratedUrl(ticket.videoUrl)||ticket.canonicalPromotion!==false)){clearTicket();return null}return ticket}catch{clearTicket();return null}}
export function consumeGameplayVisioTicket(){const ticket=readGameplayVisioTicket();clearTicket();return ticket}
export const GAMEPLAY_VISIO_REQUEST_EVENT=REQUEST_EVENT;
export const GAMEPLAY_VISIO_READY_EVENT=READY_EVENT;

console.info('[Visio Director] MonIA transient generation handoff active; candidate use never auto-promotes canon');