const SAVE_KEY='marion-lucas-save-v4';
const QUEUE_KEY='monia-media-opportunities-v1';
const EVENT_NAME='marion-lucas:media-opportunities';

type LooseSave={day?:number;time?:string;place?:string;relationship?:number;trust?:number;chemistry?:number;metLucas?:boolean;official?:boolean;outfit?:string;eventHistory?:string[];memories?:string[]};
export type MediaOpportunity={id:string;family:string;priority:number;expiresAt:number;contextKey:string;constraints:{place:string;outfit:string;relationshipBand:string};candidateOnly:true;narrativeAuthority:false};

function readSave():LooseSave|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}}
function band(value=0){if(value>=70)return'intimate';if(value>=45)return'close';if(value>=25)return'affectionate';if(value>=10)return'early';return'unknown'}
function hash(value:string){let h=0;for(let i=0;i<value.length;i++)h=((h<<5)-h+value.charCodeAt(i))|0;return Math.abs(h).toString(36)}

function build(save:LooseSave):MediaOpportunity[]{
  if(!save.metLucas)return[];
  const relationship=Number(save.relationship||0),trust=Number(save.trust||0),chemistry=Number(save.chemistry||0);
  const relationshipBand=band(relationship);
  const place=save.place||'unknown',outfit=save.outfit||'gameplay-current';
  const base=`${place}|${relationshipBand}|${outfit}|${save.day||0}`;
  const families:Array<[string,number]>=[
    ['reaction-closeup',90],
    ['conversation-two-shot',84],
    ['arrival-departure',72],
    ['quiet-proximity',Math.min(88,55+Math.round(chemistry*.28))],
    ['comfort-support',Math.min(86,50+Math.round(trust*.3))],
  ];
  if(relationship>=25&&chemistry>=25)families.push(['romantic-approach',76]);
  if(relationship>=45&&trust>=35)families.push(['affectionate-contact',78]);
  if(relationship>=70&&trust>=60&&chemistry>=55)families.push(['intimate-transition-fade',74]);
  return families
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5)
    .map(([family,priority])=>({
      id:`opp-${hash(`${base}|${family}`)}`,family,priority,expiresAt:Date.now()+20*60*1000,contextKey:base,
      constraints:{place,outfit,relationshipBand},candidateOnly:true,narrativeAuthority:false,
    }));
}

function refresh(){
  const save=readSave();if(!save)return;
  const queue=build(save);
  try{sessionStorage.setItem(QUEUE_KEY,JSON.stringify(queue))}catch{}
  window.dispatchEvent(new CustomEvent<MediaOpportunity[]>(EVENT_NAME,{detail:queue}));
}

let timer=0;
function schedule(){window.clearTimeout(timer);timer=window.setTimeout(refresh,700)}
window.addEventListener('storage',schedule);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
window.setInterval(refresh,15000);
window.setTimeout(refresh,1200);

export function readMediaOpportunities():MediaOpportunity[]{try{const raw=sessionStorage.getItem(QUEUE_KEY);return raw?JSON.parse(raw) as MediaOpportunity[]:[]}catch{return[]}}
export const MEDIA_OPPORTUNITIES_EVENT=EVENT_NAME;
console.info('[MonIA] Media Predictor active: candidate-only opportunities, zero narrative authority, no player-facing spoilers');
