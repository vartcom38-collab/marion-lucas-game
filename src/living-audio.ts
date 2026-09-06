const SAVE_KEY='marion-lucas-save-v4';
const SETTINGS_KEY='marion-lucas-settings-v2';

type LooseSave={place?:string;time?:string;screen?:string};
type SoundProfile={air:number;airHz:number;body:number;bodyHz:number;presence:number;presenceHz:number;master:number};

let ctx:AudioContext|null=null;
let master:GainNode|null=null;
let noise:AudioBufferSourceNode|null=null;
let airFilter:BiquadFilterNode|null=null;
let airGain:GainNode|null=null;
let bodyOsc:OscillatorNode|null=null;
let bodyGain:GainNode|null=null;
let presenceFilter:BiquadFilterNode|null=null;
let presenceGain:GainNode|null=null;
let unlocked=false;
let lastKey='';
let pulseTimer=0;

function readJSON<T>(key:string,fallback:T):T{
  try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}
}
function readSave(){return readJSON<LooseSave|null>(SAVE_KEY,null)}
function soundEnabled(){return readJSON<{sound?:boolean}>(SETTINGS_KEY,{sound:true}).sound!==false}
function hour(time='12:00'){const h=Number(time.slice(0,2));return Number.isFinite(h)?h:12}
function partOfDay(h:number){return h<6?'night':h<11?'morning':h<18?'day':h<21?'evening':'night'}

function profile(place='home',h=12):SoundProfile{
  const p=place.toLowerCase();
  const part=partOfDay(h);
  const night=part==='night';
  const evening=part==='evening';
  const city=['nimes','cafe','station','madrid'].includes(p);
  const arena=p==='arenes';
  const country=['finca','estate','family'].includes(p);
  if(p==='home')return{air:night?.006:.009,airHz:night?850:1450,body:.004,bodyHz:night?42:48,presence:.0015,presenceHz:1200,master:night?.5:.62};
  if(arena)return{air:.017,airHz:1900,body:.009,bodyHz:58,presence:.012,presenceHz:720,master:night?.48:.68};
  if(city)return{air:night?.010:.014,airHz:night?1300:2200,body:.006,bodyHz:52,presence:evening?.010:.007,presenceHz:980,master:night?.52:.64};
  if(country)return{air:night?.010:.018,airHz:night?900:1650,body:.0035,bodyHz:44,presence:.002,presenceHz:1450,master:night?.48:.66};
  return{air:.010,airHz:1500,body:.004,bodyHz:48,presence:.003,presenceHz:1100,master:.58};
}

function makeNoiseBuffer(context:AudioContext){
  const length=context.sampleRate*4;
  const buffer=context.createBuffer(1,length,context.sampleRate);
  const data=buffer.getChannelData(0);
  let last=0;
  for(let i=0;i<length;i++){
    const white=Math.random()*2-1;
    last=.985*last+.015*white;
    data[i]=white*.3+last*.7;
  }
  return buffer;
}

function setup(){
  if(ctx)return;
  const Ctor=window.AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!Ctor)return;
  ctx=new Ctor();
  master=ctx.createGain();
  master.gain.value=0;
  master.connect(ctx.destination);

  noise=ctx.createBufferSource();
  noise.buffer=makeNoiseBuffer(ctx);
  noise.loop=true;

  airFilter=ctx.createBiquadFilter();
  airFilter.type='lowpass';
  airFilter.frequency.value=1400;
  airGain=ctx.createGain();
  airGain.gain.value=0;
  noise.connect(airFilter).connect(airGain).connect(master);

  presenceFilter=ctx.createBiquadFilter();
  presenceFilter.type='bandpass';
  presenceFilter.Q.value=.55;
  presenceGain=ctx.createGain();
  presenceGain.gain.value=0;
  noise.connect(presenceFilter).connect(presenceGain).connect(master);

  bodyOsc=ctx.createOscillator();
  bodyOsc.type='sine';
  bodyGain=ctx.createGain();
  bodyGain.gain.value=0;
  bodyOsc.connect(bodyGain).connect(master);

  noise.start();
  bodyOsc.start();
}

function ramp(param:AudioParam|null|undefined,value:number,seconds=.8){
  if(!ctx||!param)return;
  const now=ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value,now);
  param.linearRampToValueAtTime(value,now+seconds);
}

function apply(){
  if(!ctx||!master)return;
  const save=readSave();
  const gameVisible=!!document.querySelector('.game');
  const enabled=soundEnabled()&&gameVisible&&!document.hidden;
  const place=save?.place||'home';
  const h=hour(save?.time);
  const key=`${place}:${partOfDay(h)}:${enabled?'on':'off'}`;
  if(key===lastKey)return;
  lastKey=key;
  const p=profile(place,h);
  ramp(master.gain,enabled?p.master:0,1.2);
  ramp(airGain?.gain,enabled?p.air:0,1.4);
  ramp(bodyGain?.gain,enabled?p.body:0,1.4);
  ramp(presenceGain?.gain,enabled?p.presence:0,1.4);
  ramp(airFilter?.frequency,p.airHz,1.6);
  ramp(presenceFilter?.frequency,p.presenceHz,1.6);
  ramp(bodyOsc?.frequency,p.bodyHz,1.6);
}

function ambientPulse(){
  if(!ctx||!presenceGain||!soundEnabled()||!document.querySelector('.game')||document.hidden)return;
  const save=readSave();
  const place=(save?.place||'home').toLowerCase();
  if(place==='home')return;
  const base=profile(place,hour(save?.time)).presence;
  if(base<=.002)return;
  const now=ctx.currentTime;
  const peak=base*(1.25+Math.random()*.55);
  presenceGain.gain.cancelScheduledValues(now);
  presenceGain.gain.setValueAtTime(Math.max(.0001,presenceGain.gain.value),now);
  presenceGain.gain.linearRampToValueAtTime(peak,now+.45);
  presenceGain.gain.linearRampToValueAtTime(base,now+2.4+Math.random()*2);
}

async function unlock(){
  if(unlocked)return;
  setup();
  if(!ctx)return;
  try{await ctx.resume();unlocked=true;apply()}catch{return}
}

for(const event of ['pointerdown','keydown'] as const){
  window.addEventListener(event,unlock,{once:true,passive:true});
}

new MutationObserver(()=>apply()).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
window.addEventListener('storage',()=>{lastKey='';apply()});
document.addEventListener('visibilitychange',()=>{lastKey='';apply()});
pulseTimer=window.setInterval(ambientPulse,7000);
window.addEventListener('beforeunload',()=>{if(pulseTimer)window.clearInterval(pulseTimer)});

console.info('[World] Contextual audio engine ready');
