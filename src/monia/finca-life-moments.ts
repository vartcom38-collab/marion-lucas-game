import './finca-life-moments.css';
import './madrid-home-life';
const SAVE_KEY='marion-lucas-save-v4';
const MOMENT_KEY='marion-lucas-finca-moments-v1';

type Save={day?:number;time?:string;place?:string;screen?:string;stress?:number;energy?:number;relationship?:number;flags?:Record<string,unknown>;seed?:number};
type MomentState={lastDay:number;shown:string[]};
type Moment={id:string;title:string;text:string;minHour:number;maxHour:number;choices:Array<{label:string;minutes:number;stress:number;energy:number;relationship:number;note:string}>};

const MOMENTS:Moment[]=[
  {id:'gate-visit',title:'On passe les voir',text:'Quelqu’un de leur entourage est dans le coin et propose de passer un moment à la maison.',minHour:11,maxHour:20,choices:[{label:'Faire entrer',minutes:90,stress:-2,energy:-4,relationship:1,note:'La maison s’est remplie un moment de voix et de présence.'},{label:'Proposer un autre jour',minutes:5,stress:-1,energy:0,relationship:0,note:'Ils gardent la maison calme ce soir.'}]},
  {id:'late-dinner',title:'Rien n’était prévu',text:'La soirée s’est étirée et aucun des deux n’a vraiment envie de ressortir. Il reste à décider comment finir la journée.',minHour:19,maxHour:23,choices:[{label:'Dîner tranquillement ici',minutes:75,stress:-5,energy:1,relationship:2,note:'Le dîner a pris son temps, sans programme autour.'},{label:'Improviser quelque chose dehors',minutes:110,stress:-2,energy:-4,relationship:1,note:'Ils ont changé d’air sur un coup de tête.'}]},
  {id:'terrace-evening',title:'La soirée est douce',text:'La lumière baisse encore sur la propriété. Personne ne les attend immédiatement ailleurs.',minHour:17,maxHour:22,choices:[{label:'Rester dehors ensemble',minutes:55,stress:-6,energy:0,relationship:2,note:'Ils sont restés dehors jusqu’à ce que la lumière disparaisse.'},{label:'Rentrer au salon',minutes:45,stress:-4,energy:2,relationship:1,note:'La soirée s’est poursuivie au calme à l’intérieur.'}]},
  {id:'unexpected-call',title:'Le téléphone sonne',text:'Un appel arrive au mauvais ou au bon moment, selon la façon dont ils décident de le prendre.',minHour:9,maxHour:22,choices:[{label:'Répondre maintenant',minutes:25,stress:1,energy:-1,relationship:0,note:'L’appel a brièvement déplacé le centre de la journée.'},{label:'Laisser sonner',minutes:2,stress:-1,energy:0,relationship:1,note:'Ils ont laissé le téléphone attendre.'}]},
  {id:'slow-return',title:'De retour chez eux',text:'Ils viennent de rentrer et la finca paraît particulièrement calme après l’extérieur.',minHour:15,maxHour:23,choices:[{label:'Ne rien prévoir',minutes:50,stress:-7,energy:3,relationship:1,note:'Ils ont laissé le retour rester un vrai retour.'},{label:'Se retrouver autour d’un verre',minutes:40,stress:-4,energy:0,relationship:2,note:'Ils ont pris le temps de se retrouver avant la suite.'}]},
];

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function writeSave(s:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));return true}catch{return false}}
function readState():MomentState{try{const raw=localStorage.getItem(MOMENT_KEY);if(!raw)return{lastDay:-999,shown:[]};const p=JSON.parse(raw) as Partial<MomentState>;return{lastDay:Number(p.lastDay??-999),shown:Array.isArray(p.shown)?p.shown:[]}}catch{return{lastDay:-999,shown:[]}}}
function writeState(s:MomentState){try{localStorage.setItem(MOMENT_KEY,JSON.stringify(s));return true}catch{return false}}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function hour(s:Save){return Number(String(s.time||'12:00').slice(0,2))||12}
function addMinutes(s:Save,minutes:number){const parts=String(s.time||'12:00').split(':').map(Number);let total=(parts[0]||12)*60+(parts[1]||0)+minutes;while(total>=1440){total-=1440;s.day=Math.max(1,Number(s.day||1)+1)}s.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function deterministic(save:Save,salt:number){const seed=Number(save.seed||17),day=Number(save.day||1);return Math.abs(((seed*1103515245+day*12345+salt*2654435761)>>>0)%1000)/1000}
function eligibleMoment(save:Save,state:MomentState){if(save.place!=='estate'||(save.screen&&save.screen!=='game'))return null;const day=Number(save.day||1);if(day-state.lastDay<3)return null;const h=hour(save);const pool=MOMENTS.filter(m=>h>=m.minHour&&h<=m.maxHour&&!state.shown.slice(-3).includes(m.id));if(!pool.length)return null;if(deterministic(save,3)>.32)return null;return pool[Math.floor(deterministic(save,7)*pool.length)%pool.length]}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}

function showMoment(moment:Moment){if(document.getElementById('moniaFincaMoment'))return;const root=document.createElement('aside');root.id='moniaFincaMoment';root.className='fincaLifeMoment';root.innerHTML=`<div class="fincaLifeMomentCard"><small>À LA FINCA</small><h3>${esc(moment.title)}</h3><p>${esc(moment.text)}</p><div>${moment.choices.map((c,i)=>`<button data-finca-moment-choice="${i}">${esc(c.label)}</button>`).join('')}</div><button class="fincaLifeMomentLater" data-finca-moment-later>Pas maintenant</button></div>`;document.body.appendChild(root);
  root.querySelectorAll<HTMLButtonElement>('[data-finca-moment-choice]').forEach(btn=>btn.onclick=()=>{const save=readSave();if(!save){root.remove();return}const choice=moment.choices[Number(btn.dataset.fincaMomentChoice||0)];addMinutes(save,choice.minutes);save.stress=clamp(Number(save.stress??20)+choice.stress);save.energy=clamp(Number(save.energy??70)+choice.energy);save.relationship=clamp(Number(save.relationship??50)+choice.relationship);const flags=save.flags||(save.flags={});flags.lastFincaLifeMoment=moment.id;flags.lastFincaLifeMomentNote=choice.note;const state=readState();state.lastDay=Number(save.day||1);state.shown=[...state.shown,moment.id].slice(-8);writeState(state);writeSave(save);root.remove();window.dispatchEvent(new CustomEvent('monia:finca-life-moment',{detail:{id:moment.id,note:choice.note}}))});
  root.querySelector<HTMLButtonElement>('[data-finca-moment-later]')?.addEventListener('click',()=>{const save=readSave(),state=readState();if(save)state.lastDay=Math.max(state.lastDay,Number(save.day||1)-1);writeState(state);root.remove()});
}

let timer=0;function scheduleCheck(){window.clearTimeout(timer);timer=window.setTimeout(()=>{const save=readSave();if(!save)return;const moment=eligibleMoment(save,readState());if(moment)showMoment(moment)},900)}
window.addEventListener('storage',scheduleCheck);window.addEventListener('monia:finca-home-changed',scheduleCheck as EventListener);new MutationObserver(scheduleCheck).observe(document.body,{childList:true,subtree:true});scheduleCheck();

declare global{interface Window{__moniaFincaLifeMomentCheck?:()=>void}}
window.__moniaFincaLifeMomentCheck=scheduleCheck;
