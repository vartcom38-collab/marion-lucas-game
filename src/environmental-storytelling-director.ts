import './environmentalStorytellingDirector.css';

type SaveLike={day:number;place:string;screen:string;official:boolean;relationship:number;trust:number;flags:Record<string,boolean|number|string>};
const SAVE_KEY='marion-lucas-save-v4';
let lastSignature='';

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function homeLike(place:string){return['finca','estate','madrid'].includes(place)}
function clean(game:HTMLElement){game.querySelector('#environmentalStorytellingLayer')?.remove();lastSignature=''}

function stage(s:SaveLike){
  const finca=Math.max(Number(s.flags.fincaBelongingLevel||0),Number(s.flags.fincaDaysSeen||0)>=7?4:Number(s.flags.fincaDaysSeen||0)>=5?3:Number(s.flags.fincaDaysSeen||0)>=3?2:Number(s.flags.fincaDaysSeen||0)>=1?1:0);
  const rituals=Number(s.flags.coupleRitualCount||0);
  const domestic=Number(s.flags.domesticCoexistenceLastDay||0)>0;
  const returned=Number(s.flags.postTravelHomeResetDay||0)===s.day;
  const close=Number(s.relationship||0)>=68&&Number(s.trust||0)>=50;
  return{finca,rituals,domestic,returned,close};
}

function propsFor(s:SaveLike){
  const x=stage(s);const out:string[]=[];
  if(s.place==='finca'||s.place==='estate'){
    if(x.finca>=1)out.push('bag');
    if(x.finca>=2)out.push('bath');
    if(x.finca>=3)out.push('book','charger');
    if(x.finca>=4)out.push('drawer');
    if(x.rituals>=2)out.push('mugs');
    if(x.domestic&&x.close)out.push('jacket');
    if(x.returned)out.push('travelbag');
  }else if(s.place==='madrid'){
    if(x.rituals>=2)out.push('mugs');
    if(x.domestic)out.push('jacket');
    if(x.close)out.push('book','charger');
    if(x.returned)out.push('travelbag');
  }
  return out;
}

function render(){
  const s=read();const game=document.querySelector<HTMLElement>('main.game');
  if(!s||!game||s.screen!=='game'||!s.official||!homeLike(s.place)){if(game)clean(game);return}
  const props=propsFor(s);const sig=`${s.place}|${props.join(',')}`;if(sig===lastSignature&&game.querySelector('#environmentalStorytellingLayer'))return;
  clean(game);lastSignature=sig;if(!props.length)return;
  const layer=document.createElement('div');layer.id='environmentalStorytellingLayer';layer.className=`environmentalStorytellingLayer env-${s.place}`;layer.setAttribute('aria-hidden','true');
  props.forEach((kind,i)=>{const node=document.createElement('i');node.className=`envProp env-${kind}`;node.style.setProperty('--env-i',String(i));layer.appendChild(node)});
  game.appendChild(layer);
}

window.addEventListener('storage',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
window.setInterval(render,12000);
window.setTimeout(render,900);
console.info('[World] environmental storytelling layer active: shared history now leaves visible traces in familiar places');
