type SceneLease={owner:string;startedAt:number;expiresAt:number};

let lease:SceneLease|null=null;
const HARD_BLOCKERS='#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.travelCurtain';

function now(){return Date.now()}
function clearExpired(){if(lease&&lease.expiresAt<=now())lease=null}

export function sceneBlocked(owner?:string){
  clearExpired();
  if(document.querySelector(HARD_BLOCKERS))return true;
  return !!lease&&lease.owner!==owner;
}

export function acquireScene(owner:string,ttlMs=90000){
  clearExpired();
  if(sceneBlocked(owner))return false;
  lease={owner,startedAt:now(),expiresAt:now()+Math.max(5000,ttlMs)};
  window.dispatchEvent(new CustomEvent('marion:scene-lease',{detail:{owner,active:true}}));
  return true;
}

export function releaseScene(owner:string){
  clearExpired();
  if(!lease||lease.owner!==owner)return false;
  lease=null;
  window.dispatchEvent(new CustomEvent('marion:scene-lease',{detail:{owner,active:false}}));
  return true;
}

export function sceneOwner(){clearExpired();return lease?.owner||null}

window.addEventListener('pagehide',()=>{lease=null});

declare global{
  interface Window{
    __marionSceneOwner?:()=>string|null;
    __marionSceneBlocked?:(owner?:string)=>boolean;
  }
}
window.__marionSceneOwner=sceneOwner;
window.__marionSceneBlocked=sceneBlocked;
