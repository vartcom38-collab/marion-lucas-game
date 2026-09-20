import productionMap from '../config/day1-visual-production-map.json';

type SaveLike={day:number;place:string;metDominic?:boolean;metLucas?:boolean;outfit?:string;flags?:Record<string,unknown>};

export type Day1VisualSlot={
  id:string;kind:string;duration:string;priority:string;identity?:string[];
  location?:string;variantsBy?:string;notes?:string;
};

export function getDay1VisualSlot(save:SaveLike, event:string):Day1VisualSlot|null{
  if(Number(save.day)!==1)return null;
  const met=Boolean(save.metDominic||save.metLucas);
  const slots=productionMap.slots as Day1VisualSlot[];
  if(event==='home-idle'&&save.place==='home')return slots.find(s=>s.id==='day1-home-living-idle')||null;
  if(event==='wardrobe')return slots.find(s=>s.id==='day1-wardrobe-transition')||null;
  if(event==='leave-home'&&save.place==='home')return slots.find(s=>s.id==='day1-leave-home')||null;
  if(event==='marine'&&!met)return slots.find(s=>s.id==='day1-marine-rendezvous')||null;
  if(event==='first-contact'&&!met)return slots.find(s=>s.id==='day1-first-contact')||null;
  return null;
}

export function day1VisualVariant(save:SaveLike,slot:Day1VisualSlot){
  if(slot.variantsBy==='outfit')return String(save.outfit||'default');
  if(slot.variantsBy==='firstContactContext')return String(save.flags?.firstContactContext||'arena-midday');
  return 'default';
}

export function dispatchDay1VisualRequest(save:SaveLike,event:string){
  const slot=getDay1VisualSlot(save,event);if(!slot)return false;
  window.dispatchEvent(new CustomEvent('monia:visual-slot-request',{detail:{
    slotId:slot.id,variant:day1VisualVariant(save,slot),kind:slot.kind,
    identity:slot.identity||[],location:slot.location||null,
    generatedUI:false,masterAspect:'16:9',responsiveTargets:['desktop','ipad','iphone']
  }}));
  return true;
}
