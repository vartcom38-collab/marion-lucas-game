const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;children?:number;official?:boolean;married?:boolean;flags?:Record<string,unknown>;eventHistory?:string[]};
export type ChildcareMode='not-needed'|'nanny'|'family-support'|'travel-nanny';
export type ChildcareSnapshot={needed:boolean;available:boolean;mode:ChildcareMode;canGoOut:boolean;canTravel:boolean;canFollowLucas:boolean;overnightPossible:boolean;reason:string};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
export function getChildcareSnapshot(context:'home'|'outing'|'travel'|'torero-travel'='home'):ChildcareSnapshot|null{
  const s=read();if(!s)return null;const kids=n(s.children);if(kids<=0)return{needed:false,available:true,mode:'not-needed',canGoOut:true,canTravel:true,canFollowLucas:true,overnightPossible:true,reason:'Aucun mode de garde n’est nécessaire.'};
  const mode:ChildcareMode=context==='torero-travel'||context==='travel'?'travel-nanny':'nanny';
  return{needed:true,available:true,mode,canGoOut:true,canTravel:true,canFollowLucas:true,overnightPossible:true,reason:context==='torero-travel'?'Une solution de garde fiable est prévue. Marion peut accompagner Lucas sur ses déplacements de corrida si elle le souhaite, sans devoir renoncer automatiquement parce qu’ils ont des enfants.':context==='travel'?'La garde peut s’organiser pour un déplacement ou un séjour. Les enfants ne bloquent pas automatiquement la mobilité de Marion.':'Une nounou peut prendre le relais quand Marion et Lucas sortent ou ont leurs propres obligations. Leur vie sociale ne s’arrête pas avec les enfants.'};
}
declare global{interface Window{__moniaChildcare?:(context?:'home'|'outing'|'travel'|'torero-travel')=>ChildcareSnapshot|null}}
window.__moniaChildcare=getChildcareSnapshot;
