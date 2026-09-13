import {getLifeAgeSnapshot,MARION_BIRTHDAY,LUCAS_BIRTHDAY,isMarionBirthday,isLucasBirthday} from './life-age-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Target='marion'|'lucas';
type CalendarItem={owner:'Marion'|'Lucas'|'Nous';title:string;day:number;note:string};
type Save={day?:number;metLucas?:boolean;relationship?:number;trust?:number;calendar?:CalendarItem[];eventHistory?:string[];memories?:string[];flags?:Record<string,unknown>;updatedAt?:number};
export type BirthdaySnapshot={day:number;lifeYear:number;today:Target[];next:{target:Target;day:number;daysUntil:number;label:string}[];canonical:true};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));window.dispatchEvent(new CustomEvent('monia:birthday-changed'));return true}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function annualDay(lifeYear:number,dayOfYear:number){return(Math.max(1,lifeYear)-1)*365+dayOfYear}
function nextBirthdayDay(currentDay:number,birthdayDayOfYear:number){const year=Math.floor((Math.max(1,currentDay)-1)/365)+1;const thisYear=annualDay(year,birthdayDayOfYear);return thisYear>=currentDay?thisYear:annualDay(year+1,birthdayDayOfYear)}
function ensureCalendarItem(s:Save,item:CalendarItem){if(!Array.isArray(s.calendar))s.calendar=[];if(s.calendar.some(x=>x.day===item.day&&x.title===item.title))return false;s.calendar.push(item);return true}
function addHistory(s:Save,event:string){const h=Array.isArray(s.eventHistory)?s.eventHistory:[];if(!h.includes(event))h.push(event);s.eventHistory=h.slice(-420)}
function addMemory(s:Save,text:string){const m=Array.isArray(s.memories)?s.memories:[];if(!m.includes(text))m.unshift(text);s.memories=m.slice(0,80)}

export function ensureBirthdayCalendar(){const s=read();if(!s)return false;const lifeYear=getLifeAgeSnapshot(s).lifeYear;let changed=false;changed=ensureCalendarItem(s,{owner:'Marion',title:'Anniversaire de Marion',day:annualDay(lifeYear,MARION_BIRTHDAY.dayOfYear),note:'4 juillet · journée anniversaire'})||changed;changed=ensureCalendarItem(s,{owner:'Lucas',title:'Anniversaire de Lucas',day:annualDay(lifeYear,LUCAS_BIRTHDAY.dayOfYear),note:'3 octobre · journée anniversaire'})||changed;if(changed)write(s);return changed}

export function getBirthdaySnapshot():BirthdaySnapshot|null{const s=read();if(!s)return null;const ages=getLifeAgeSnapshot(s),day=ages.day;const today:Target[]=[];if(isMarionBirthday(day))today.push('marion');if(isLucasBirthday(day))today.push('lucas');const marionDay=nextBirthdayDay(day,MARION_BIRTHDAY.dayOfYear),lucasDay=nextBirthdayDay(day,LUCAS_BIRTHDAY.dayOfYear);return{day,lifeYear:ages.lifeYear,today,next:[{target:'marion',day:marionDay,daysUntil:marionDay-day,label:MARION_BIRTHDAY.label},{target:'lucas',day:lucasDay,daysUntil:lucasDay-day,label:LUCAS_BIRTHDAY.label}].sort((a,b)=>a.daysUntil-b.daysUntil),canonical:true}}

export function planBirthdayEvent(target:Target,title:string){const s=read();if(!s||!title.trim())return false;const day=Math.max(1,n(s.day,1));const birthdayDay=nextBirthdayDay(day,target==='marion'?MARION_BIRTHDAY.dayOfYear:LUCAS_BIRTHDAY.dayOfYear);const owner:CalendarItem['owner']=target==='marion'?'Marion':'Lucas';const clean=title.trim();if(!Array.isArray(s.calendar))s.calendar=[];if(s.calendar.some(x=>x.day===birthdayDay&&x.title===clean))return false;s.calendar.push({owner,title:clean,day:birthdayDay,note:`Prévu pour l’anniversaire du ${target==='marion'?MARION_BIRTHDAY.label:LUCAS_BIRTHDAY.label}.`});addHistory(s,`birthday-plan:${target}:${birthdayDay}:${clean.toLowerCase().replace(/\s+/g,'-').slice(0,40)}`);return write(s)}

export function offerBirthdayGift(target:Target,gift:string){const s=read();if(!s||!gift.trim())return false;const day=Math.max(1,n(s.day,1));if(target==='marion'&&!isMarionBirthday(day))return false;if(target==='lucas'&&!isLucasBirthday(day))return false;if(target==='lucas'&&!s.metLucas)return false;const clean=gift.trim();const key=`birthday-gift:${target}:${day}:${clean.toLowerCase().replace(/\s+/g,'-').slice(0,40)}`;if((s.eventHistory||[]).includes(key))return false;addHistory(s,key);if(target==='lucas'){s.relationship=clamp(n(s.relationship,0)+2);s.trust=clamp(n(s.trust,0)+1);addMemory(s,`Marion a offert ${clean} à Lucas pour son anniversaire.`)}else{addMemory(s,`Marion a reçu ${clean} pour son anniversaire.`)}return write(s)}

function refresh(){window.setTimeout(()=>{try{ensureBirthdayCalendar()}catch{}},0)}
window.setTimeout(refresh,1400);window.addEventListener('marion:statechange',refresh as EventListener);window.addEventListener('monia:save-changed',refresh as EventListener);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

declare global{interface Window{__moniaBirthdays?:()=>BirthdaySnapshot|null;__moniaPlanBirthdayEvent?:(target:Target,title:string)=>boolean;__moniaOfferBirthdayGift?:(target:Target,gift:string)=>boolean;__moniaEnsureBirthdayCalendar?:()=>boolean}}
window.__moniaBirthdays=getBirthdaySnapshot;window.__moniaPlanBirthdayEvent=planBirthdayEvent;window.__moniaOfferBirthdayGift=offerBirthdayGift;window.__moniaEnsureBirthdayCalendar=ensureBirthdayCalendar;
