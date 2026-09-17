const QUEUE_KEY='monia-v16-runtime-requests-v1';
const REQUEST_EVENT='marion-lucas:monia-v16-request';
const READY_EVENT='marion-lucas:monia-v16-ready';

export type LucasV16Intent='neutral'|'warm'|'tender'|'concerned'|'tired'|'amused'|'whisper';
export type LucasV16Request={
  id:string;
  actor:'Lucas';
  text:string;
  intent:LucasV16Intent;
  sceneJobId?:string;
  createdAt:number;
  status:'queued';
  renderer:'scripts/monia_lucas_v16_runtime_voice.py';
  fallback:'forbidden';
};
export type LucasV16Ready={id:string;audioUrl:string;duration:number;text:string;sceneJobId?:string};

function readQueue():LucasV16Request[]{
  try{const raw=sessionStorage.getItem(QUEUE_KEY);return raw?JSON.parse(raw) as LucasV16Request[]:[]}catch{return[]}
}
function writeQueue(queue:LucasV16Request[]){try{sessionStorage.setItem(QUEUE_KEY,JSON.stringify(queue.slice(-20)))}catch{}}
function hash(value:string){let h=0;for(let i=0;i<value.length;i++)h=((h<<5)-h+value.charCodeAt(i))|0;return Math.abs(h).toString(36)}

export function requestLucasV16(text:string,intent:LucasV16Intent='neutral',sceneJobId?:string){
  const clean=text.trim();
  if(!clean)throw new Error('Lucas V16 request requires non-empty text');
  const id=`v16-${hash(`${clean}|${intent}|${sceneJobId||''}|${Date.now()}`)}`;
  const request:LucasV16Request={id,actor:'Lucas',text:clean,intent,sceneJobId,createdAt:Date.now(),status:'queued',renderer:'scripts/monia_lucas_v16_runtime_voice.py',fallback:'forbidden'};
  const queue=readQueue();queue.push(request);writeQueue(queue);
  window.dispatchEvent(new CustomEvent<LucasV16Request>(REQUEST_EVENT,{detail:request}));
  return request;
}

export function consumeLucasV16Request(id:string){const queue=readQueue();const hit=queue.find(item=>item.id===id)||null;if(hit)writeQueue(queue.filter(item=>item.id!==id));return hit}
export function readLucasV16Requests(){return readQueue()}
export function announceLucasV16Ready(detail:LucasV16Ready){window.dispatchEvent(new CustomEvent<LucasV16Ready>(READY_EVENT,{detail}))}
export const LUCAS_V16_REQUEST_EVENT=REQUEST_EVENT;
export const LUCAS_V16_READY_EVENT=READY_EVENT;

console.info('[MonIA] Shared Lucas V16 runtime bridge active · generic voice fallback forbidden');
