import {consumeGameplayVisioTicket,readGameplayVisioTicket} from './gameplay-visio-director';

const BLOCKED_EVENT='marion-lucas:visio-launch-blocked';

function block(event:Event,reason:string){
  event.preventDefault();
  event.stopImmediatePropagation();
  window.dispatchEvent(new CustomEvent(BLOCKED_EVENT,{detail:{reason}}));
  console.info('[Visio Guard] launch blocked:',reason);
}

document.addEventListener('click',event=>{
  const target=event.target as HTMLElement|null;
  const launch=target?.closest<HTMLElement>('[data-monia-visio]');
  if(!launch)return;
  const ticket=readGameplayVisioTicket();
  if(!ticket){block(event,'missing-or-expired-gameplay-ticket');return}
  // Let the already-installed renderer read the ticket during this click, then
  // invalidate it immediately so the same authorization cannot be replayed.
  window.setTimeout(()=>{consumeGameplayVisioTicket()},0);
},true);

export const VISIO_LAUNCH_BLOCKED_EVENT=BLOCKED_EVENT;
console.info('[Visio Guard] legacy launch buttons require an approved gameplay ticket');
