type Profile='home'|'street'|'feria'|'quiet';

let ctx:AudioContext|null=null;
let master:GainNode|null=null;
let noise:AudioBufferSourceNode|null=null;
let low:BiquadFilterNode|null=null;
let mid:BiquadFilterNode|null=null;
let lowGain:GainNode|null=null;
let midGain:GainNode|null=null;
let rumble:OscillatorNode|null=null;
let rumbleGain:GainNode|null=null;
let unlocked=false;
let current:Profile='home';
let pulse=0;

function buffer(context:AudioContext){
  const len=context.sampleRate*5;
  const b=context.createBuffer(1,len,context.sampleRate);
  const d=b.getChannelData(0);
  let pink=0;
  for(let i=0;i<len;i++){
    const white=Math.random()*2-1;
    pink=.985*pink+.015*white;
    d[i]=white*.28+pink*.72;
  }
  return b;
}

function setup(){
  if(ctx)return;
  const Ctor=window.AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!Ctor)return;
  ctx=new Ctor();
  master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
  noise=ctx.createBufferSource();noise.buffer=buffer(ctx);noise.loop=true;

  low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=1100;
  lowGain=ctx.createGain();lowGain.gain.value=.008;
  noise.connect(low).connect(lowGain).connect(master);

  mid=ctx.createBiquadFilter();mid.type='bandpass';mid.Q.value=.55;mid.frequency.value=950;
  midGain=ctx.createGain();midGain.gain.value=.002;
  noise.connect(mid).connect(midGain).connect(master);

  rumble=ctx.createOscillator();rumble.type='sine';rumble.frequency.value=48;
  rumbleGain=ctx.createGain();rumbleGain.gain.value=.002;
  rumble.connect(rumbleGain).connect(master);

  noise.start();rumble.start();
}

function ramp(p:AudioParam|undefined|null,v:number,s=.7){
  if(!ctx||!p)return;
  const now=ctx.currentTime;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value,now);
  p.linearRampToValueAtTime(v,now+s);
}

function apply(){
  if(!ctx||!master)return;
  const p=current;
  const values=p==='home'
    ?{m:.42,lo:.006,lf:950,mi:.0012,mf:1300,ru:.0015,rf:44}
    :p==='street'
      ?{m:.56,lo:.012,lf:1850,mi:.006,mf:1000,ru:.0038,rf:51}
      :p==='feria'
        ?{m:.64,lo:.016,lf:2200,mi:.012,mf:760,ru:.0065,rf:58}
        :{m:.34,lo:.004,lf:800,mi:.001,mf:1200,ru:.001,rf:42};
  ramp(master.gain,values.m,1.1);
  ramp(lowGain?.gain,values.lo,1.2);
  ramp(low?.frequency,values.lf,1.2);
  ramp(midGain?.gain,values.mi,1.2);
  ramp(mid?.frequency,values.mf,1.2);
  ramp(rumbleGain?.gain,values.ru,1.2);
  ramp(rumble?.frequency,values.rf,1.2);
}

function cityPulse(){
  if(!ctx||!midGain||document.hidden||current==='home'||current==='quiet')return;
  const base=current==='feria'?.012:.006;
  const now=ctx.currentTime;
  const peak=base*(1.3+Math.random()*.8);
  midGain.gain.cancelScheduledValues(now);
  midGain.gain.setValueAtTime(Math.max(.0001,midGain.gain.value),now);
  midGain.gain.linearRampToValueAtTime(peak,now+.35);
  midGain.gain.linearRampToValueAtTime(base,now+1.8+Math.random()*2.2);
}

async function unlock(){
  if(unlocked)return;
  setup();
  if(!ctx)return;
  try{await ctx.resume();unlocked=true;apply()}catch{}
}

window.addEventListener('playtest-ambience',((event:CustomEvent<{profile?:Profile}>)=>{
  current=event.detail?.profile||'home';
  apply();
}) as EventListener);

for(const e of ['pointerdown','keydown'] as const)window.addEventListener(e,unlock,{once:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(!ctx||!master)return;ramp(master.gain,document.hidden?0:(current==='feria'?.64:current==='street'?.56:.42),.5)});
pulse=window.setInterval(cityPulse,5200);
window.addEventListener('beforeunload',()=>{if(pulse)window.clearInterval(pulse)});

console.info('[Playtest] Ambient audio layer active');
