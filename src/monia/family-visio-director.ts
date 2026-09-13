import { getChildrenLife } from './children-life';
import { requestFamilyVideoCall } from './trusted-nanny-life';

const APPROVED_URL='./config/family-visio-approved.json';
type ApprovedEntry={id?:string;childId?:string;media?:string;state?:string};
type ApprovedManifest={status?:string;policy?:Record<string,unknown>;entries?:ApprovedEntry[]};
export type FamilyVisioAvailability={available:boolean;childId?:string;media?:string;reason:string};

async function manifest():Promise<ApprovedManifest|null>{try{const r=await fetch(APPROVED_URL,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}
export async function getFamilyVisioAvailability(childId?:string):Promise<FamilyVisioAvailability>{
  const kids=getChildrenLife();if(!kids.length)return{available:false,reason:'Aucun enfant n’est concerné par une visio familiale.'};const child=childId?kids.find(k=>k.id===childId):kids[0];if(!child)return{available:false,reason:'Cet enfant n’existe pas dans la sauvegarde active.'};
  const m=await manifest();if(!m||m.status!=='locked'||m.policy?.approval_required!==true||m.policy?.child_media_requires_explicit_approval!==true)return{available:false,childId:child.id,reason:'La visio famille n’est pas dans un état de validation sûr.'};
  const entry=(m.entries||[]).find(e=>e.childId===child.id&&typeof e.media==='string'&&e.media.trim());if(!entry)return{available:false,childId:child.id,reason:'Aucun clip visio enfant approuvé pour cet enfant.'};
  return{available:true,childId:child.id,media:entry.media,reason:'Un média famille explicitement approuvé est disponible.'};
}
export async function requestApprovedFamilyVisio(childId?:string){
  const pending=requestFamilyVideoCall(childId);const availability=await getFamilyVisioAvailability(childId);window.dispatchEvent(new CustomEvent('monia:family-visio-request',{detail:{pending,availability}}));if(!availability.available)return false;window.dispatchEvent(new CustomEvent('monia:family-visio-ready',{detail:availability}));return true
}
declare global{interface Window{__moniaFamilyVisioAvailability?:(childId?:string)=>Promise<FamilyVisioAvailability>;__moniaRequestApprovedFamilyVisio?:(childId?:string)=>Promise<boolean>}}
window.__moniaFamilyVisioAvailability=getFamilyVisioAvailability;window.__moniaRequestApprovedFamilyVisio=requestApprovedFamilyVisio;
