import {getLucasCommunicationPolicy} from './lucas-presence-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;phoneUnread?:number;messages?:Array<{from:string;text:string;day:number;read:boolean;thread?:string}>;flags?:Record<string,boolean|number|string>;updatedAt?:number};
type Row={person:string;day:string;time:string;kind:string;state:string;duration:string};
let busy=false;

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function parse(raw:string):Row[]{return raw.split('§').filter(Boolean).map(x=>{const [person,day,time,kind,state,duration]=x.split('|');return{person,day,time,kind,state,duration}})}
function serialize(rows:Row[]){return rows.map(r=>[r.person,r.day,r.time,r.kind,r.state,r.duration].join('|')).join('§')}
function priority(state:string){return({ended:6,missed:6,unreachable:6,local:6,cancelled:5,connected:4,started:2} as Record<string,number>)[state]||1}
function minute(t:string){const [h,m]=String(t||'0:0').split(':').map(Number);return(h||0)*60+(m||0)}
function sameCall(a:Row,b:Row){if(a.person!==b.person||a.kind!==b.kind||a.day!==b.day)return false;return Math.abs(minute(a.time)-minute(b.time))<=2}

function consolidate(rows:Row[]){const out:Row[]=[];for(const row of rows){const idx=out.findIndex(x=>sameCall(x,row));if(idx<0){out.push(row);continue}const current=out[idx];if(priority(row.state)>priority(current.state))out[idx]={...row,duration:Number(row.duration||0)>=Number(current.duration||0)?row.duration:current.duration};else if(Number(row.duration||0)>Number(current.duration||0))out[idx]={...current,duration:row.duration};}return out.slice(0,30)}
function unreadSms(s:Save){return(s.messages||[]).filter(m=>m.from!=='Toi'&&!m.read).length}

function syncPhoneDom(){const policy=getLucasCommunicationPolicy();const phone=document.querySelector<HTMLElement>('.phoneDevice');if(!phone)return;phone.dataset.lucasPhoneMode=policy.mode;phone.dataset.lucasPhoneLabel=policy.label;document.querySelectorAll<HTMLButtonElement>('[data-social-call="lucas"]').forEach(btn=>{if(policy.mode==='local'){btn.disabled=true;btn.textContent='Avec toi';btn.title='Lucas est physiquement avec Marion';}else{btn.disabled=false;btn.textContent='Appeler';btn.title=policy.label;}});document.querySelectorAll<HTMLElement>('.socialProfileHero').forEach(hero=>{const name=hero.querySelector('h3')?.textContent?.trim();if(name!=='Lucas')return;hero.dataset.lucasPhoneMode=policy.mode;});}

function repair(){if(busy)return;const s=read();if(!s)return;busy=true;try{const f=s.flags||(s.flags={});const raw=String(f.socialCallHistory||'');const fixed=serialize(consolidate(parse(raw)));let changed=false;if(raw!==fixed){f.socialCallHistory=fixed;changed=true}const sms=unreadSms(s);const generic=Math.max(0,Number(f.nativeGenericUnread||0));if(f.nativeUnreadReady===true){const expected=generic+sms;if(Number(s.phoneUnread||0)!==expected){s.phoneUnread=expected;changed=true}f.nativeLastSmsUnread=sms;f.nativeLastPhoneUnread=expected;}if(changed){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('marion:phone-consistency'))}}finally{busy=false}syncPhoneDom()}

window.addEventListener('marion:statechange',()=>window.setTimeout(repair,0));window.addEventListener('storage',repair);window.addEventListener('marion:phone-refresh',repair as EventListener);document.addEventListener('visibilitychange',()=>{if(!document.hidden)repair()});window.setInterval(repair,4000);repair();

console.info('[Phone consistency] call history, unread counts and Lucas phone state consolidated');
