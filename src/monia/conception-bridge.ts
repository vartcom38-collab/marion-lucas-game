import { conceptionMayRoll } from './intimacy-life-layer';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;seed?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type ConceptionResult={checked:boolean;possible:boolean;conceived:boolean;reason:string;nextCheckDay?:number};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function deterministicRoll(s:Save,salt:number){let x=(n(s.seed,7919)+n(s.day,1)*104729+salt*8191)%2147483647;x=(x*48271)%2147483647;return x/2147483647}

export function resolveConceptionWindow():ConceptionResult{
  const s=read();if(!s)return{checked:false,possible:false,conceived:false,reason:'Aucune partie active.'};
  const f=s.flags||(s.flags={});
  if(!conceptionMayRoll())return{checked:false,possible:false,conceived:false,reason:'Aucun moment intime compatible avec une conception n’a eu lieu.'};
  const day=Math.max(1,n(s.day,1));
  const lastEventDay=n(f.qualifyingConceptionEventDay,n(f.lastIntimacyDay,day));
  if(day<lastEventDay)return{checked:false,possible:true,conceived:false,reason:'La fenêtre n’est pas encore arrivée.'};
  if(n(f.lastConceptionRollDay,-999)===day)return{checked:false,possible:true,conceived:!!f.pregnancyPossible,reason:'Cette fenêtre a déjà été évaluée aujourd’hui.'};
  const trying=String(f.contraceptionMode)==='trying';
  const chance=trying?0.24:0.12; // game simulation values, not medical probabilities
  const roll=deterministicRoll(s,n(f.intimacyCount,1)+17);
  f.lastConceptionRollDay=day;
  f.qualifyingConceptionEvent=false;
  f.qualifyingConceptionEventConsumedDay=day;
  if(roll<chance){
    f.pregnancyPossible=true;
    f.pregnancyPossibleDay=day;
    f.pregnancyTestEarliestDay=day+10;
    s.eventHistory=[...(s.eventHistory||[]),'pregnancy-possible-hidden'].slice(-160);
    write(s);
    return{checked:true,possible:true,conceived:true,reason:'Une grossesse devient possible mais reste inconnue du joueur.',nextCheckDay:day+10};
  }
  f.nextConceptionWindowDay=day+1;
  write(s);
  return{checked:true,possible:true,conceived:false,reason:'Cette fenêtre n’a pas conduit à une grossesse.'};
}

declare global{interface Window{__moniaResolveConceptionWindow?:()=>ConceptionResult}}
window.__moniaResolveConceptionWindow=resolveConceptionWindow;
