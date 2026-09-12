import './world-map-experience.css';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;place?:string;metLucas?:boolean;flags?:Record<string,unknown>;memories?:string[]};

const POSITION:Record<string,[number,number]>={
  home:[22,67],nimes:[35,52],cafe:[48,65],arenes:[57,39],station:[72,60],
  madrid:[37,29],family:[51,20],finca:[65,31],estate:[79,18]
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c))}
function placeId(tile:HTMLButtonElement,index:number){return tile.dataset.place||`place-${index}`}
function tileData(tile:HTMLButtonElement,index:number){
  const id=placeId(tile,index);const img=tile.querySelector<HTMLImageElement>('img')?.src||'';const title=tile.querySelector('strong')?.textContent?.trim()||id;const sub=tile.querySelector('span')?.textContent?.trim()||'';const meta=tile.querySelector('small')?.textContent?.trim()||'';return{id,img,title,sub,meta,tile};
}
function routeLines(ids:string[]){
  const points=ids.map(id=>({id,pos:POSITION[id]})).filter(x=>x.pos) as Array<{id:string;pos:[number,number]}>;
  if(points.length<2)return'';
  return points.slice(1).map((p,i)=>{const a=points[i].pos,b=p.pos;return`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`}).join('');
}
function build(panel:HTMLElement){
  if(panel.dataset.moniaMapReady==='1')return;
  const save=read();if(!save)return;
  const gallery=panel.querySelector<HTMLElement>('.worldGallery');if(!gallery)return;
  const tiles=[...gallery.querySelectorAll<HTMLButtonElement>('.worldTile')].filter(t=>!t.disabled&&!t.classList.contains('futurePlaceHidden'));
  if(!tiles.length)return;
  panel.dataset.moniaMapReady='1';panel.classList.add('moniaTravelMapPanel');gallery.classList.add('moniaOriginalMapGallery');
  const data=tiles.map(tileData);
  const current=data.find(x=>x.id===save.place)||data[0];
  const map=document.createElement('section');map.className='moniaTravelMap';
  map.innerHTML=`<div class="moniaMapHero"><div><span>CARTE DE VIE</span><h2>${esc(current?.title||'Votre monde')}</h2><p>Les lieux apparaissent au fil de ta vie. Choisis où aller sans voir ce qui n’est pas encore entré dans ton histoire.</p></div>${current?.img?`<img src="${current.img}" alt="">`:''}</div><div class="moniaMapCanvas"><div class="moniaMapTexture"></div><svg class="moniaMapRoutes" viewBox="0 0 100 100" preserveAspectRatio="none">${routeLines(data.map(x=>x.id))}</svg>${data.map((x,i)=>{const pos=POSITION[x.id]||[18+(i%4)*22,28+Math.floor(i/4)*35];return`<button class="moniaMapPin ${x.id===save.place?'is-current':''}" data-map-target="${esc(x.id)}" style="--mx:${pos[0]}%;--my:${pos[1]}%"><i></i><span>${esc(x.sub)}</span><strong>${esc(x.title)}</strong><small>${x.id===save.place?'Tu es ici':esc(x.meta||'Accessible')}</small></button>`}).join('')}</div><div class="moniaMapPreview"><div class="moniaMapPreviewPhoto">${current?.img?`<img src="${current.img}" alt="">`:''}</div><div><span>MAINTENANT</span><strong>${esc(current?.title||'')}</strong><small>${esc(current?.sub||'')}</small><p>${esc(current?.meta||'Choisis un lieu sur la carte.')}</p></div></div>`;
  gallery.before(map);
  map.querySelectorAll<HTMLButtonElement>('[data-map-target]').forEach(pin=>pin.addEventListener('click',()=>{
    const id=pin.dataset.mapTarget||'';const entry=data.find(x=>x.id===id);if(!entry)return;
    map.querySelectorAll('.moniaMapPin').forEach(x=>x.classList.toggle('is-selected',x===pin));
    const preview=map.querySelector<HTMLElement>('.moniaMapPreview');if(preview)preview.innerHTML=`<div class="moniaMapPreviewPhoto">${entry.img?`<img src="${entry.img}" alt="">`:''}</div><div><span>${id===save.place?'MAINTENANT':'DESTINATION'}</span><strong>${esc(entry.title)}</strong><small>${esc(entry.sub)}</small><p>${esc(entry.meta||'Accessible')}</p>${id===save.place?'<em>Tu es déjà ici.</em>':`<button type="button" data-travel-confirm="${esc(id)}">Y aller</button>`}</div>`;
  }));
  map.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-travel-confirm]');if(!b)return;const target=data.find(x=>x.id===b.dataset.travelConfirm);target?.tile.click()});
}
function enhance(){document.querySelectorAll<HTMLElement>('.worldGalleryPanel').forEach(build)}
const observer=new MutationObserver(enhance);observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('storage',e=>{if(!e.key||e.key===SAVE_KEY)enhance()});setTimeout(enhance,150);
