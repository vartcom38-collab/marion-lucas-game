const QUEUE_KEY='monia-surprise-delivery-queue-v1';
const HUMAN_APPROVAL_MODE='atomic-whole-scene';

type Delivery={approvalMode?:string;assetId?:string;route?:string};

function readQueue():Delivery[]{
  try{
    const raw=localStorage.getItem(QUEUE_KEY);
    const value=raw?JSON.parse(raw):[];
    return Array.isArray(value)?value:[];
  }catch{return []}
}

function sanitizeQueue(){
  const queue=readQueue();
  const kept=queue.filter(item=>item?.approvalMode===HUMAN_APPROVAL_MODE);
  if(kept.length===queue.length)return kept;
  try{localStorage.setItem(QUEUE_KEY,JSON.stringify(kept))}catch{/* optional */}
  window.dispatchEvent(new CustomEvent('monia:cinematic-approval-guard',{detail:{removed:queue.length-kept.length,remaining:kept.length}}));
  return kept;
}

window.addEventListener('storage',event=>{
  if(event.key===QUEUE_KEY)sanitizeQueue();
});
window.addEventListener('monia:surprise-scene-ready',()=>sanitizeQueue());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sanitizeQueue()});
queueMicrotask(()=>sanitizeQueue());

console.info('[Cinema] Human approval guard active');
