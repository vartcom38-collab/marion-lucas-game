type SaveLike={day:number;time:string;place:string;energy:number;stress:number;outfit:string;memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};
const KEY='marion-lucas-save-v4';
function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
function mins(t:string){const [h,m]=t.split(':').map(Number);return h*60+m}
function time(total:number){total=Math.max(0,Math.min(1439,total));return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function remember(s:SaveLike,v:string){if(!v)return;if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(v))s.memories.unshift(v);s.memories=s.memories.slice(0,40)}
function apply(e:CustomEvent){const s=read();if(!s)return;const fx=(e.detail?.effects||{}) as Record<string,unknown>;
 if(typeof fx.minutes==='number')s.time=time(mins(s.time)+fx.minutes);
 if(typeof fx.energy==='number')s.energy=Math.max(0,Math.min(100,s.energy+fx.energy));
 if(typeof fx.stress==='number')s.stress=Math.max(0,Math.min(100,s.stress+fx.stress));
 if(typeof fx.outfit==='string')s.outfit=fx.outfit;
 if(typeof fx.place==='string')s.place=fx.place;
 if(typeof fx.memory==='string')remember(s,fx.memory);
 if(fx.flags&&typeof fx.flags==='object')Object.assign(s.flags,fx.flags);
 s.flags.lastLivingNode=String(e.detail?.nodeId||'');s.flags.lastLivingChoice=String(e.detail?.choiceId||'');s.updatedAt=Date.now();
 localStorage.setItem(KEY,JSON.stringify(s));
 window.dispatchEvent(new CustomEvent('marion:day-one-refresh'));window.dispatchEvent(new Event('storage'));
}
window.addEventListener('monia:living-choice',apply as EventListener);
