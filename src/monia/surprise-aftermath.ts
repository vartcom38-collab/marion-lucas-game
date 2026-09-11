const SAVE_KEY='marion-lucas-save-v4';

type LooseSave={
  day?:number;
  time?:string;
  place?:string;
  eventHistory?:string[];
  memories?:string[];
  flags?:Record<string,string|number|boolean>;
};

type PlaybackResult={
  route?:string;
  assetId?:string;
  reason?:'ended'|'skipped'|'error';
  consumed?:boolean;
};

function readSave():LooseSave|null{
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}
}
function writeSave(save:LooseSave){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch{/* optional */}}
function gameMinutes(day?:number,time='00:00'){
  const [h,m]=String(time||'00:00').split(':').map(Number);
  return Number(day||0)*1440+(Number.isFinite(h)?h:0)*60+(Number.isFinite(m)?m:0);
}

function markPlaybackStarted(detail:PlaybackResult){
  const save=readSave();
  if(!save)return;
  const flags=save.flags||(save.flags={});
  flags.moniaCinematicActive=true;
  flags.moniaSurpriseActiveAsset=String(detail.assetId||'');
  flags.moniaSurpriseActiveRoute=String(detail.route||'');
  writeSave(save);
}

function markPlaybackFinished(detail:PlaybackResult){
  const save=readSave();
  if(!save)return;
  const flags=save.flags||(save.flags={});
  flags.moniaCinematicActive=false;
  flags.moniaSurpriseActiveAsset='';
  flags.moniaSurpriseActiveRoute='';

  if(detail.consumed){
    const minute=gameMinutes(save.day,save.time);
    flags.moniaSurpriseLastPlaybackGameMinute=minute;
    flags.moniaSurprisePlaybackCount=Number(flags.moniaSurprisePlaybackCount||0)+1;
    flags.moniaSurpriseLastRoute=String(detail.route||'');
    flags.moniaSurpriseLastAssetId=String(detail.assetId||'');
    flags.moniaSurpriseLastResult=String(detail.reason||'ended');

    const stamp=`J${Number(save.day||0)} ${save.time||'00:00'}`;
    const marker=`${stamp} · Une scène cinématique approuvée s'est déroulée (${String(detail.route||'scene')}).`;
    const events=save.eventHistory||(save.eventHistory=[]);
    if(!events.includes(marker))events.push(marker);
    save.eventHistory=events.slice(-120);
  }

  writeSave(save);
  window.dispatchEvent(new CustomEvent('monia:game-state-after-surprise',{detail:{...detail,day:save.day,time:save.time,place:save.place}}));
}

window.addEventListener('monia:surprise-playback-started',(event)=>{
  markPlaybackStarted((event as CustomEvent<PlaybackResult>).detail||{});
});
window.addEventListener('monia:surprise-playback-result',(event)=>{
  markPlaybackFinished((event as CustomEvent<PlaybackResult>).detail||{});
});
window.addEventListener('beforeunload',()=>{
  const save=readSave();
  if(!save?.flags?.moniaCinematicActive)return;
  save.flags.moniaCinematicActive=false;
  save.flags.moniaSurpriseActiveAsset='';
  save.flags.moniaSurpriseActiveRoute='';
  writeSave(save);
});
