export type SequenceShot={url:string;sequenceIndex:number;sequenceLength:number;shotSize?:string;angle?:string};

type ReadyDetail={id:string;sceneId:string;intent:string;shots:SequenceShot[]};

let activeId:string|null=null;

function ensurePlayer(){
 let root=document.getElementById('monia-cinematic-sequence-player') as HTMLDivElement|null;
 if(root)return root;
 root=document.createElement('div');
 root.id='monia-cinematic-sequence-player';
 root.setAttribute('aria-hidden','true');
 Object.assign(root.style,{position:'fixed',inset:'0',zIndex:'8',background:'#000',display:'none',overflow:'hidden'});
 const a=document.createElement('video');const b=document.createElement('video');
 for(const [i,v] of [a,b].entries()){
  v.id=`monia-cinematic-track-${i}`;v.playsInline=true;v.preload='auto';v.muted=false;
  Object.assign(v.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',opacity:i===0?'1':'0'});
  root.appendChild(v);
 }
 document.body.appendChild(root);return root;
}

const track=(root:HTMLElement,n:number)=>root.querySelector(`#monia-cinematic-track-${n}`) as HTMLVideoElement;

export async function playCinematicSequence(detail:ReadyDetail){
 if(!detail?.shots?.length)return;
 const root=ensurePlayer();activeId=detail.id;root.style.display='block';root.setAttribute('aria-hidden','false');
 const shots=[...detail.shots].sort((a,b)=>a.sequenceIndex-b.sequenceIndex);
 let current=0;
 for(let i=0;i<shots.length;i++){
  if(activeId!==detail.id)break;
  const cur=track(root,current),next=track(root,1-current);
  cur.src=shots[i].url;cur.currentTime=0;cur.style.opacity='1';
  if(shots[i+1]){next.src=shots[i+1].url;next.load()}
  window.dispatchEvent(new CustomEvent('monia:cinematic-shot-playing',{detail:{sequenceId:detail.id,sceneId:detail.sceneId,index:i,total:shots.length,shot:shots[i]}}));
  await cur.play();
  await new Promise<void>(resolve=>{const done=()=>{cur.removeEventListener('ended',done);resolve()};cur.addEventListener('ended',done,{once:true})});
  cur.style.opacity='0';current=1-current;
 }
 if(activeId===detail.id){
  root.style.display='none';root.setAttribute('aria-hidden','true');activeId=null;
  window.dispatchEvent(new CustomEvent('monia:cinematic-sequence-complete',{detail:{id:detail.id,sceneId:detail.sceneId,intent:detail.intent}}));
 }
}

export function stopCinematicSequence(){
 activeId=null;const root=document.getElementById('monia-cinematic-sequence-player');if(!root)return;
 root.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load()});(root as HTMLElement).style.display='none';root.setAttribute('aria-hidden','true');
}

export function installCinematicSequencePlayer(){
 ensurePlayer();
 window.addEventListener('monia:cinematic-sequence-ready',((e:CustomEvent)=>{void playCinematicSequence(e.detail).catch(err=>console.error('[MonIA cinematic player]',err))}) as EventListener);
 window.addEventListener('monia:cinematic-sequence-stop',(()=>stopCinematicSequence()) as EventListener);
}
