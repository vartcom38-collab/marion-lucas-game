import './living-social-runtime.css';

const SAVE_KEY='marion-lucas-save-v4';
type Message={from:string;text:string;day:number;read:boolean;to?:string};
type CalendarItem={owner:'Marion'|'Lucas'|'Nous';title:string;day:number;note:string};
type Save={day?:number;time?:string;place?:string;screen?:string;metLucas?:boolean;official?:boolean;relationship?:number;trust?:number;stress?:number;energy?:number;messages?:Message[];calendar?:CalendarItem[];memories?:string[];flags?:Record<string,unknown>;updatedAt?:number};
type ActorId='marine'|'lucas'|'family';
type Presence={id:ActorId;name:string;label:string;detail:string;action:string;minutes:number};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){try{s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));window.dispatchEvent(new CustomEvent('marion:statechange',{detail:{source:'living-social'}}));return true}catch{return false}}
function flags(s:Save){if(!s.flags)s.flags={};return s.flags}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t=String(read()?.time||'12:00')){const [h,m]=t.split(':').map(Number);return (h||0)*60+(m||0)}
function addMinutes(s:Save,delta:number){let total=mins(String(s.time||'12:00'))+delta;while(total>=1440){total-=1440;s.day=n(s.day,1)+1}s.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function remember(s:Save,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,60)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function isLucasBusy(s:Save){if(!s.metLucas)return true;const now=mins(String(s.time||'12:00'));const items=(s.calendar||[]).filter(i=>i.owner==='Lucas'&&i.day===n(s.day,1));return items.some(i=>{const t=i.title.toLowerCase();let a=600,b=960;if(t.includes('entraînement')||t.includes('préparation')){a=480;b=780}else if(t.includes('déplacement')){a=420;b=1260}else if(t.includes('apoderado')){a=600;b=840}else if(t.includes('récupération')){a=540;b=780}else if(t.includes('invitation')||t.includes('plateau')||t.includes('prix')||t.includes('vernissage')){a=1020;b=1380}return now>=a&&now<b})}
function atLucasHome(s:Save){const f=flags(s);return s.place==='madrid'&&Boolean(f.visitingLucasMadrid||f.atLucasMadridHome||f.madridHomeVisit||f.stayingWithLucasMadrid||f.madridHomeShared)}
function togetherWithLucas(s:Save){if(!s.metLucas||isLucasBusy(s))return false;if(atLucasHome(s))return true;if(s.place==='family'&&s.official)return true;if(s.place==='estate'&&s.official)return true;if(s.place==='finca'&&Boolean(flags(s).lucasPresentAtFinca))return true;return false}
function marineNearby(s:Save){const f=flags(s),day=n(s.day,1),place=String(s.place||'');if(day===1&&Boolean(f.dayOneWithMarine))return ['nimes','cafe','arenes'].includes(place);if(!['nimes','cafe','arenes'].includes(place))return false;const last=n(f.livingSocialMarineDay,-99);if(day-last<3)return false;const social=n(f.socialCircle,0)+n(f.dayOneMarineMomentCount,0);return social>0&&hash(`marine:${day}:${place}`)%5===0}
function familyActive(s:Save){return s.place==='family'}

export function getLivingPresence():Presence|null{
 const s=read();if(!s||s.screen&&s.screen!=='game')return null;const h=Math.floor(mins(String(s.time||'12:00'))/60);
 if(familyActive(s))return{id:'family',name:'La famille',label:h<12?'La maison s’éveille':h<19?'Quelqu’un est dans les parages':'La soirée se pose',detail:h<12?'La cuisine et le salon commencent à vivre.':h<19?'Tu peux rester avec eux ou continuer ce que tu fais.':'Personne ne te presse de faire quoi que ce soit.',action:h<12?'Rester un moment avec eux':h<19?'Partager un moment':'Rester encore un peu',minutes:h<12?35:50};
 if(togetherWithLucas(s))return{id:'lucas',name:'Lucas',label:'Il est vraiment là',detail:s.place==='madrid'?'Vous êtes au même endroit. Le téléphone ne remplace pas ce moment.':'Sa présence suit le lieu et son agenda.',action:'Passer un moment ensemble',minutes:45};
 if(marineNearby(s))return{id:'marine',name:'Marine',label:'Pas très loin',detail:'Elle est dans le secteur sans transformer ta journée en rendez-vous obligatoire.',action:'La rejoindre un moment',minutes:40};
 return null;
}

const impossibleSamePlaceTexts=new Set(['Bien dormi ?','Je pense à toi. Journée chargée ici.','Tu fais quoi ce soir ?','Appelle-moi quand tu peux.','Bonne journée :)','Tu es toujours à Nîmes aujourd’hui ?','Je repensais à hier.']);
function pruneImpossibleLucasMessages(s:Save){if(!togetherWithLucas(s)||!Array.isArray(s.messages))return false;const day=n(s.day,1),before=s.messages.length;s.messages=s.messages.filter(m=>!(m.from==='Lucas'&&m.day===day&&!m.read&&impossibleSamePlaceTexts.has(m.text)));if(s.messages.length!==before){flags(s).livingSocialContinuityRepairDay=day;return true}return false}
function incomingExists(s:Save,from:string,text:string){return (s.messages||[]).some(m=>m.from===from&&m.text===text&&m.day===n(s.day,1))}
function pushIncoming(s:Save,from:string,text:string){if(incomingExists(s,from,text))return false;if(!Array.isArray(s.messages))s.messages=[];s.messages.unshift({from,text,day:n(s.day,1),read:false});const f=flags(s);f.phoneToast=`${from}|${text.slice(0,90)}`;f.phoneToastAt=n(s.day,1)*1440+mins(String(s.time||'12:00'));return true}
function maybeSeedAmbientMessage(s:Save){const f=flags(s),day=n(s.day,1),place=String(s.place||'');if(day<2)return false;if(togetherWithLucas(s))return false;let changed=false;
 const marineLast=n(f.livingSocialMarineSmsDay,-99);if(day-marineLast>=4&&Boolean(f.dayOneSocialSeeded||n(f.socialCircle,0)>0)&&['home','nimes','cafe','arenes'].includes(place)&&hash(`marine-sms:${day}`)%6===0){const pool=['Tu fais quoi aujourd’hui ?','Je passe peut-être en ville plus tard 👀','J’ai pensé à toi en passant près du centre.'];const text=pool[hash(`marine-copy:${day}`)%pool.length];if(pushIncoming(s,'Marine',text)){f.livingSocialMarineSmsDay=day;changed=true}}
 const lucasLast=n(f.livingSocialLucasSmsDay,-99);if(s.metLucas&&day-lucasLast>=3&&!['madrid','family','estate'].includes(place)&&hash(`lucas-sms:${day}:${place}`)%5===0){const pool=s.official?['Journée chargée ici. Écris-moi quand tu veux.','Je pense à toi. On se parle plus tard ?','Tu me racontes ta journée quand tu peux ?']:['Bonne journée :)','Tu fais quoi aujourd’hui ?','Je repensais à notre dernière conversation.'];const text=pool[hash(`lucas-copy:${day}`)%pool.length];if(pushIncoming(s,'Lucas',text)){f.livingSocialLucasSmsDay=day;changed=true}}
 return changed;
}

export function doLivingSocialMoment(actor:ActorId){const s=read();if(!s)return false;const p=getLivingPresence();if(!p||p.id!==actor)return false;addMinutes(s,p.minutes);const f=flags(s);if(actor==='marine'){s.stress=clamp(n(s.stress,10)-3);f.livingSocialMarineDay=n(s.day,1);f.socialCircle=n(f.socialCircle,0)+1;f.lastSocialPerson='Marine';f.lastSocialPlace=String(s.place||'');remember(s,'Un moment simple avec Marine a trouvé sa place dans une journée normale.')}else if(actor==='lucas'){s.relationship=clamp(n(s.relationship,0)+2);s.trust=clamp(n(s.trust,0)+1);s.stress=clamp(n(s.stress,10)-3);f.livingSocialLucasSharedDay=n(s.day,1);f.lastSharedLucasPlace=String(s.place||'');f.lastSharedLucasTime=String(s.time||'');remember(s,'Un moment partagé avec Lucas a compté parce qu’ils étaient réellement au même endroit.')}else{s.stress=clamp(n(s.stress,10)-4);s.energy=clamp(n(s.energy,70)-1);f.livingSocialFamilyDay=n(s.day,1);f.familyOrdinaryMoments=n(f.familyOrdinaryMoments,0)+1;f.lastFamilyPlace=String(s.place||'family');remember(s,'La maison familiale a accueilli un moment ordinaire, sans occasion spéciale.')}return write(s)}

function host(){return document.querySelector<HTMLElement>('main.game,.game,.worldStage,.worldScene')||null}
function remove(){document.getElementById('livingSocialCue')?.remove()}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
function render(){const s=read();if(!s){remove();return}let changed=pruneImpossibleLucasMessages(s);if(maybeSeedAmbientMessage(s))changed=true;if(changed)write(s);const p=getLivingPresence(),h=host();if(!p||!h){remove();return}let root=document.getElementById('livingSocialCue');if(!root){root=document.createElement('aside');root.id='livingSocialCue';root.className='livingSocialCue';h.appendChild(root)}root.dataset.actor=p.id;root.innerHTML=`<button type="button" data-living-social="${p.id}"><span>${esc(p.name.toUpperCase())}</span><strong>${esc(p.label)}</strong><small>${esc(p.detail)}</small><em>${esc(p.action)} · ${p.minutes} min</em></button>`;const b=root.querySelector<HTMLButtonElement>('[data-living-social]');if(b)b.onclick=e=>{e.stopPropagation();if(doLivingSocialMoment(p.id))render()}}
let timer=0;function schedule(){if(timer)window.clearTimeout(timer);timer=window.setTimeout(render,120)}
window.addEventListener('storage',schedule);window.addEventListener('marion:statechange',schedule as EventListener);window.addEventListener('monia:madrid-home-changed',schedule as EventListener);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n instanceof HTMLElement&&(n.matches?.('main.game,.game')||n.querySelector?.('main.game,.game')))))schedule()}).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});window.setInterval(schedule,9000);schedule();

declare global{interface Window{__moniaLivingPresence?:()=>Presence|null;__moniaLivingSocialMoment?:(actor:ActorId)=>boolean}}
window.__moniaLivingPresence=getLivingPresence;window.__moniaLivingSocialMoment=doLivingSocialMoment;
console.info('[Living social] presence, ambient contact and same-place continuity active');
