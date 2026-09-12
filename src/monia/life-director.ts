const SAVE_KEY='marion-lucas-save-v4';

export type LifeChoiceKind='story'|'phone'|'travel'|'self'|'wait';
export type LifeChoice={id:string;label:string;kind:LifeChoiceKind;action?:string;intent:string;weight:number};
export type LifeDirectorSnapshot={
  day:number;
  time:string;
  place:string;
  age:number;
  lifeYear:number;
  chapter:string;
  narrative:string;
  choices:LifeChoice[];
  freeActions:{phone:boolean;map:boolean;wardrobe:boolean;journal:boolean};
  surpriseBudget:{voice:boolean;cinematic:boolean;call:boolean;message:boolean};
};

type Message={from?:string;text?:string;read?:boolean;day?:number};
type Save={day?:number;time?:string;place?:string;marionAge?:number;metLucas?:boolean;official?:boolean;relationship?:number;trust?:number;stress?:number;energy?:number;phoneUnread?:number;messages?:Message[];flags?:Record<string,unknown>;eventHistory?:string[];calendar?:Array<{day?:number;owner?:string;title?:string}>};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function ageFor(s:Save){const start=Number(s.marionAge||20);return start+Math.floor(Math.max(0,Number(s.day||1)-1)/365)}
function latestUnread(s:Save){return [...(s.messages||[])].reverse().find(m=>m?.read===false&&m?.text)}
function chapterFor(s:Save){
  const age=ageFor(s),met=!!s.metLucas,official=!!s.official;
  if(!met)return age<=21?'Une vie qui commence':'Trouver son rythme';
  if(!official)return'Ce qui se rapproche';
  if(age<25)return'Construire à deux';
  if(age<35)return'Choisir sa vie';
  if(age<50)return'Une vie pleine';
  return'Ce qui reste et grandit';
}
function narrativeFor(s:Save){
  const h=mins(String(s.time||'09:00')),place=String(s.place||'home'),unread=latestUnread(s);
  if(unread){const who=String(unread.from||'Quelqu’un');return `${who} vient de t’écrire. Tu peux regarder maintenant… ou laisser le monde attendre un peu.`}
  if(place==='home'&&h<720)return'Le matin est encore ouvert devant toi. Rien ne t’oblige à suivre une seule direction.';
  if(place==='home'&&h>=1200)return'La journée retombe doucement autour de l’appartement. Tu peux encore la faire bifurquer.';
  if(place==='nimes')return'Nîmes bouge autour de toi. Tu peux suivre une piste… ou simplement changer d’idée.';
  if(place==='cafe')return'Le café ralentit un peu le temps. Ce qui compte maintenant, c’est ce que tu choisis d’en faire.';
  if(place==='arenes')return'Autour des arènes, quelque chose peut commencer sans que tu le saches encore.';
  if(place==='madrid')return'Madrid a son propre rythme. Tu peux t’y laisser porter ou provoquer autre chose.';
  return'Le moment reste ouvert. Tu peux suivre ce qui se présente ou faire complètement autrement.';
}
function pushUnique(list:LifeChoice[],choice:LifeChoice){if(!list.some(x=>x.id===choice.id))list.push(choice)}
function choicesFor(s:Save){
  const out:LifeChoice[]=[];const place=String(s.place||'home'),h=mins(String(s.time||'09:00')),unread=latestUnread(s);
  if(unread)pushUnique(out,{id:'read-message',label:`Lire ${String(unread.from||'le message')}`,kind:'phone',intent:'open-latest-message',weight:100});
  if(place==='home'){
    if(h<720)pushUnique(out,{id:'morning',label:'Prendre le temps de commencer la journée',kind:'self',action:'breakfast',intent:'ground-morning',weight:75});
    pushUnique(out,{id:'ready',label:'Se préparer et voir où la journée mène',kind:'self',action:'ready',intent:'prepare',weight:70});
    pushUnique(out,{id:'leave-home',label:'Sortir de chez soi',kind:'travel',intent:'open-map',weight:68});
    pushUnique(out,{id:'quiet-home',label:'Rester encore un peu chez soi',kind:'self',action:'sofa',intent:'slow-down',weight:45});
  } else if(place==='nimes'){
    pushUnique(out,{id:'walk-city',label:'Marcher sans plan précis',kind:'self',action:'walk',intent:'explore',weight:70});
    pushUnique(out,{id:'cafe-city',label:'Prendre un café',kind:'self',action:'cafeGo',intent:'go-cafe',weight:65});
    pushUnique(out,{id:'change-place',label:'Changer de lieu',kind:'travel',intent:'open-map',weight:55});
  } else {
    pushUnique(out,{id:'observe',label:'Rester un moment et voir ce qui vient',kind:'wait',action:'wait',intent:'let-world-breathe',weight:55});
    pushUnique(out,{id:'change-place',label:'Partir ailleurs',kind:'travel',intent:'open-map',weight:50});
  }
  if(s.metLucas)pushUnique(out,{id:'contact-lucas',label:'Prendre ton téléphone',kind:'phone',intent:'open-phone',weight:60});
  if(out.length<4)pushUnique(out,{id:'phone-free',label:'Regarder ton téléphone',kind:'phone',intent:'open-phone',weight:35});
  if(out.length<5)pushUnique(out,{id:'improvise',label:'Faire autre chose',kind:'story',intent:'open-actions',weight:20});
  return out.sort((a,b)=>b.weight-a.weight).slice(0,5);
}
function surpriseBudget(s:Save){
  const met=!!s.metLucas,unread=Number(s.phoneUnread||0)>0,stress=Number(s.stress||0),energy=Number(s.energy||100);
  return{voice:met&&energy>20,cinematic:met&&stress<80,call:met,message:unread||met};
}
export function getLifeDirectorSnapshot():LifeDirectorSnapshot|null{
  const s=readSave();if(!s)return null;
  const day=Math.max(1,Number(s.day||1));
  return{day,time:String(s.time||'09:00'),place:String(s.place||'home'),age:ageFor(s),lifeYear:Math.floor((day-1)/365)+1,chapter:chapterFor(s),narrative:narrativeFor(s),choices:choicesFor(s),freeActions:{phone:true,map:true,wardrobe:true,journal:true},surpriseBudget:surpriseBudget(s)};
}

declare global{interface Window{__moniaLifeDirector?:()=>LifeDirectorSnapshot|null}}
window.__moniaLifeDirector=getLifeDirectorSnapshot;
