const OVERLAY_ID='moniaVisioOverlay';
const TEST_PARAM='visio-test';

function closeTestOverlay(overlay:HTMLElement){
  overlay.remove();
  const url=new URL(window.location.href);
  url.searchParams.delete(TEST_PARAM);
  window.history.replaceState({},'',url.pathname+url.search+url.hash);
}

function createTestOverlay(){
  if(document.getElementById(OVERLAY_ID))return;
  const overlay=document.createElement('div');
  overlay.id=OVERLAY_ID;
  overlay.dataset.visioTest='1';
  overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#050505;overflow:hidden';
  overlay.innerHTML='<div style="position:absolute;inset:0;background:#090807"></div><button id="endMoniaVisio" type="button" aria-label="Fermer le test" style="display:none"></button>';
  overlay.querySelector<HTMLButtonElement>('#endMoniaVisio')?.addEventListener('click',()=>closeTestOverlay(overlay));
  document.body.appendChild(overlay);
}

function maybeLaunchVisioTest(){
  const url=new URL(window.location.href);
  if(url.searchParams.get(TEST_PARAM)!=='1')return;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createTestOverlay,{once:true});
  else createTestOverlay();
}

maybeLaunchVisioTest();
