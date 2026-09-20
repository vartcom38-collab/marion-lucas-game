export type LivingChoice={id:string;label:string;next:string[];effects?:Record<string,unknown>};
export type LivingNode={
 id:string;entrySrc?:string;holdSrc?:string;choices:LivingChoice[];
 directorNext?:string[];fallbackMs?:number;
};
type RuntimeState={node:LivingNode|null;video:HTMLVideoElement|null;hold:HTMLVideoElement|null;root:HTMLElement|null;preloads:Map<string,HTMLVideoElement>};
const state:RuntimeState={node:null,video:null,hold:null,root:null,preloads:new Map()};

function ensureRoot(){
 let root=document.getElementById('livingBranchPlayer');
 if(!root){root=document.createElement('section');root.id='livingBranchPlayer';root.className='livingBranchPlayer';root.innerHTML='<video class="livingEntry" playsinline></video><video class="livingHold" playsinline loop muted></video><div class="livingChoices" aria-live="polite"></div>';document.body.appendChild(root)}
 state.root=root;state.video=root.querySelector('.livingEntry');state.hold=root.querySelector('.livingHold');return root;
}
function preload(url:string){if(!url||state.preloads.has(url))return;const v=document.createElement('video');v.preload='auto';v.playsInline=true;v.src=url;state.preloads.set(url,v)}
function showChoices(node:LivingNode){
 const root=ensureRoot(),box=root.querySelector('.livingChoices') as HTMLElement;box.innerHTML='';
 node.choices.slice(0,5).forEach((choice,i)=>{const b=document.createElement('button');b.type='button';b.className='livingChoice';b.textContent=choice.label;b.style.setProperty('--choice-index',String(i));b.onclick=()=>selectChoice(choice);box.appendChild(b);choice.next.forEach(preload)});
 root.classList.add('choiceOpen');
 window.dispatchEvent(new CustomEvent('monia:living-choice-open',{detail:{nodeId:node.id,choices:node.choices.map(c=>c.id)}}));
}
async function selectChoice(choice:LivingChoice){
 const root=ensureRoot();root.classList.add('choiceCommitted');root.querySelectorAll('button').forEach(b=>(b as HTMLButtonElement).disabled=true);
 window.dispatchEvent(new CustomEvent('monia:living-choice',{detail:{nodeId:state.node?.id,choiceId:choice.id,effects:choice.effects||{}}}));
 const candidates=choice.next.map(x=>state.preloads.get(x)).filter(Boolean) as HTMLVideoElement[];
 const target=candidates.find(v=>v.readyState>=3)||candidates[0];
 if(target){target.currentTime=0;target.muted=false;target.className='livingEntry branchTarget';root.prepend(target);await target.play().catch(()=>{});state.video?.pause();state.video?.remove();state.video=target}
 root.classList.remove('choiceOpen','choiceCommitted');
 (root.querySelector('.livingChoices') as HTMLElement).innerHTML='';
}
export async function playLivingNode(node:LivingNode){
 const root=ensureRoot();state.node=node;root.classList.add('active');root.dataset.node=node.id;
 if(node.holdSrc&&state.hold){state.hold.src=node.holdSrc;state.hold.currentTime=0;await state.hold.play().catch(()=>{})}
 if(node.entrySrc&&state.video){state.video.src=node.entrySrc;state.video.currentTime=0;state.video.muted=false;await state.video.play().catch(()=>{});state.video.onended=()=>{root.classList.add('holding');showChoices(node)}}
 else window.setTimeout(()=>showChoices(node),node.fallbackMs||400);
}
export function closeLivingNode(){const root=state.root;if(!root)return;state.video?.pause();state.hold?.pause();root.remove();state.node=null;state.root=null;state.video=null;state.hold=null;state.preloads.clear()}
window.addEventListener('monia:play-living-node',((e:CustomEvent<LivingNode>)=>playLivingNode(e.detail)) as EventListener);
