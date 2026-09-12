const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;children?:number;place?:string;flags?:Record<string,unknown>};
export type ChildcareMode='none'|'nanny-home'|'nanny-travel'|'family-backup';
export type ChildcareSnapshot={needed:boolean;available:boolean;mode:ChildcareMode;canGoOut:boolean;canTravel:boolean;canFollowLucas:boolean;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}

export function getChildcareSupport():ChildcareSnapshot|null{
  const s=read();if(!s)return null;const kids=n(s.children);
  if(kids<=0)return{needed:false,available:true,mode:'none',canGoOut:true,canTravel:true,canFollowLucas:true,reason:'Aucun mode de garde n’est nécessaire.'};
  const f=s.flags||{};const travelling=Boolean(f.activeTravelPlan||f.travelWithLucas||f.toreroTravelChoice==='follow'||f.toreroTravelChoice==='join-later');
  const mode:ChildcareMode=travelling?'nanny-travel':'nanny-home';
  return{needed:true,available:true,mode,canGoOut:true,canTravel:true,canFollowLucas:true,reason:travelling?'Une solution de garde accompagne l’organisation des déplacements : Marion peut suivre Lucas ou voyager sans que les enfants bloquent systématiquement ses choix.':'Une nounou est prévue dans leur organisation quotidienne : Marion garde une vraie vie sociale, personnelle et professionnelle.'};
}

declare global{interface Window{__moniaChildcareSupport?:()=>ChildcareSnapshot|null}}
window.__moniaChildcareSupport=getChildcareSupport;
