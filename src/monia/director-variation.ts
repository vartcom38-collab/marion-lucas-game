const SAVE_KEY='marion-lucas-save-v4';

type LooseSave={day?:number;time?:string;place?:string;eventHistory?:string[];flags?:Record<string,unknown>;seed?:number};
export type DirectorVariation={
  signature:string;
  pacing:'quiet'|'direct'|'playful'|'tender'|'intense';
  microGesture:'brief-glance'|'half-smile'|'small-pause'|'closer-lean'|'soft-breath'|'look-away-return';
  mediumBias:'text'|'voice'|'visio'|'scene'|'none';
  novelty:number;
};

function read():LooseSave|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
const PACING:DirectorVariation['pacing'][]=['quiet','direct','playful','tender','intense'];
const GESTURES:DirectorVariation['microGesture'][]=['brief-glance','half-smile','small-pause','closer-lean','soft-breath','look-away-return'];
const MEDIA:DirectorVariation['mediumBias'][]=['text','voice','visio','scene','none'];

export function getDirectorVariation(input:{actor?:string;channel?:string;playerText?:string;recentAction?:string}={}):DirectorVariation{
  const save=read();
  const recent=(save?.eventHistory||[]).slice(-5).join('|');
  const key=[save?.seed||0,save?.day||0,save?.time||'',save?.place||'',input.actor||'Lucas',input.channel||'auto',input.playerText||'',input.recentAction||'',recent].join('::');
  const h=hash(key);
  return{
    signature:`director-${(h>>>0).toString(36)}`,
    pacing:PACING[h%PACING.length],
    microGesture:GESTURES[(h>>>3)%GESTURES.length],
    mediumBias:MEDIA[(h>>>7)%MEDIA.length],
    novelty:35+((h>>>11)%61),
  };
}

export function directorVariationRules(v:DirectorVariation,requestedChannel?:string){
  const rules=[
    `VARIATION DIRECTOR ${v.signature}: garder exactement les mêmes faits et le même canon, mais varier naturellement le rythme et le micro-comportement.`,
    `Rythme suggéré: ${v.pacing}. Micro-geste suggéré si visuel: ${v.microGesture}.`,
    'Ne jamais créer un événement important, une indisponibilité, une blessure, un déplacement ou un conflit uniquement pour produire de la variété.',
    'Ne pas répéter mécaniquement une formulation ou un geste récent si une autre réaction tout aussi cohérente existe.',
  ];
  if(!requestedChannel&&v.mediumBias!=='none')rules.push(`Si plusieurs médias sont également plausibles dans le contexte, léger biais vers ${v.mediumBias}; ne jamais forcer ce média s'il est moins naturel.`);
  return rules;
}

declare global{interface Window{__moniaDirectorVariation?:(input?:{actor?:string;channel?:string;playerText?:string;recentAction?:string})=>DirectorVariation}}
window.__moniaDirectorVariation=getDirectorVariation;

console.info('[MonIA] Deterministic director variation active · canon-preserving pacing, gesture and optional medium bias');