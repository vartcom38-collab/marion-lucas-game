const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Save={day?:number;time?:string;calendar?:CalendarItem[];eventHistory?:string[];flags?:Record<string,unknown>};
export type LucasProfessionalKind='corrida'|'training'|'travel'|'media'|'team'|'recovery'|'none';
export type LucasProfessionalContext={
  kind:LucasProfessionalKind;
  active:boolean;
  title:string;
  place:string;
  startMinute:number|null;
  phase:'before'|'active'|'after'|'none';
  phone:'available'|'limited'|'unreachable';
  responseDelayMinutes:number;
  recovery:boolean;
  reason:string;
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function text(i:CalendarItem){return`${i.title||''} ${i.note||''} ${i.place||''}`.toLowerCase()}
function kindOf(i:CalendarItem):LucasProfessionalKind{const t=text(i);if(/corrida|novillada|feria|toros|arène|arena|plaza/.test(t))return'corrida';if(/entraîn|entrain|tentadero|campo|tienta/.test(t))return'training';if(/voyage|train|avion|flight|déplacement|deplacement|route|trajet/.test(t))return'travel';if(/presse|media|interview|photo|tournage/.test(t))return'media';if(/apoderado|cuadrilla|équipe|equipe|meeting|réunion|reunion/.test(t))return'team';if(/récupération|recuperation|soins|repos/.test(t))return'recovery';return'none'}
function todayItems(s:Save){const d=n(s.day,1);return(s.calendar||[]).filter(i=>n(i.day)===d&&String(i.owner||'').toLowerCase()==='lucas')}
function rank(k:LucasProfessionalKind){return k==='corrida'?7:k==='travel'?6:k==='training'?5:k==='media'?4:k==='team'?3:k==='recovery'?2:0}
function latestResultSuggestsRecovery(s:Save){const hist=s.eventHistory||[];const recent=hist.slice(-12).join(' ').toLowerCase();return/corrida-result:|injury|accident|soins/.test(recent)}

export function getLucasProfessionalContext():LucasProfessionalContext{
 const s=read();if(!s)return{kind:'none',active:false,title:'',place:'',startMinute:null,phase:'none',phone:'available',responseDelayMinutes:0,recovery:false,reason:'Aucun état professionnel chargé.'};
 const now=mins(s.time),items=todayItems(s).map(i=>({item:i,kind:kindOf(i),start:i.time?mins(i.time):null})).filter(x=>x.kind!=='none');
 let chosen=items.filter(x=>x.start!==null&&now>=Number(x.start)-45&&now<=Number(x.start)+210).sort((a,b)=>rank(b.kind)-rank(a.kind))[0];
 if(!chosen)chosen=items.filter(x=>x.start===null).sort((a,b)=>rank(b.kind)-rank(a.kind))[0];
 if(!chosen){
   const recovery=latestResultSuggestsRecovery(s)&&now<720;
   if(recovery)return{kind:'recovery',active:true,title:'Récupération',place:'',startMinute:null,phase:'after',phone:'limited',responseDelayMinutes:25,recovery:true,reason:'La dernière activité taurine laisse une fenêtre de récupération.'};
   return{kind:'none',active:false,title:'',place:'',startMinute:null,phase:'none',phone:'available',responseDelayMinutes:0,recovery:false,reason:'Aucun engagement professionnel actif.'};
 }
 const {item,kind,start}=chosen;let phase:'before'|'active'|'after'='active';if(start!==null){if(now<start)phase='before';else if(now>start+150)phase='after'}
 const place=String(item.place||item.note||'').trim(),title=String(item.title||'').trim();
 if(kind==='travel')return{kind,active:true,title,place,startMinute:start,phase,phone:'unreachable',responseDelayMinutes:75,recovery:false,reason:'Lucas est en déplacement professionnel.'};
 if(kind==='corrida'){
   if(phase==='before')return{kind,active:true,title,place,startMinute:start,phase,phone:'limited',responseDelayMinutes:50,recovery:false,reason:'Lucas est dans sa préparation avant une journée d’arène.'};
   if(phase==='active')return{kind,active:true,title,place,startMinute:start,phase,phone:'unreachable',responseDelayMinutes:90,recovery:false,reason:'Lucas est pris par une corrida ou ses obligations immédiates.'};
   return{kind,active:true,title,place,startMinute:start,phase,phone:'limited',responseDelayMinutes:35,recovery:true,reason:'Après l’arène, Lucas reste pris par récupération, équipe ou presse.'};
 }
 if(kind==='training')return{kind,active:true,title,place,startMinute:start,phase,phone:'limited',responseDelayMinutes:35,recovery:phase==='after',reason:'Lucas est pris par un entraînement ou un travail physique.'};
 if(kind==='media'||kind==='team')return{kind,active:true,title,place,startMinute:start,phase,phone:'limited',responseDelayMinutes:30,recovery:false,reason:'Lucas est retenu par une obligation professionnelle.'};
 return{kind,active:true,title,place,startMinute:start,phase,phone:'limited',responseDelayMinutes:25,recovery:true,reason:'Lucas est dans une phase de récupération.'};
}

declare global{interface Window{__moniaLucasProfessionalContext?:()=>LucasProfessionalContext}}
window.__moniaLucasProfessionalContext=getLucasProfessionalContext;
