import { getChildcareSnapshot, type ChildcareContext } from './childcare-life';

export type ChildcareMode='none'|'nanny-home'|'nanny-travel'|'family-backup'|'unarranged';
export type ChildcareSnapshot={needed:boolean;available:boolean;mode:ChildcareMode;canGoOut:boolean;canTravel:boolean;canFollowLucas:boolean;reason:string;needsPlanning:boolean};

function currentContext():ChildcareContext{
  try{
    const raw=localStorage.getItem('marion-lucas-save-v4');const s=raw?JSON.parse(raw):{};const f=s.flags||{};
    if(f.toreroTravelChoice==='follow'||f.toreroTravelChoice==='join-later')return'torero-travel';
    if(f.activeTravelPlan||f.travelWithLucas)return'travel';
    return'outing';
  }catch{return'outing'}
}

export function getChildcareSupport():ChildcareSnapshot|null{
  const snap=getChildcareSnapshot(currentContext());if(!snap)return null;
  const mode:ChildcareMode=!snap.needed?'none':snap.mode==='travel-nanny'?'nanny-travel':snap.mode==='family-support'?'family-backup':snap.mode==='nanny'?'nanny-home':'unarranged';
  return{needed:snap.needed,available:snap.available,mode,canGoOut:snap.canGoOut,canTravel:snap.canTravel,canFollowLucas:snap.canFollowLucas,reason:snap.reason,needsPlanning:snap.needsPlanning};
}

declare global{interface Window{__moniaChildcareSupport?:()=>ChildcareSnapshot|null}}
window.__moniaChildcareSupport=getChildcareSupport;
