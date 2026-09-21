import './new-game-shell.css';

type Tool='phone'|'agenda'|'map'|'memories'|null;
type DemoState={tool:Tool,phoneView:'home'|'messages'|'call',selected:string|null,place:string,time:string,memories:string[],beat:string,metDominic:boolean,year:number,hasDominicNumber:boolean,contactStage:number,day:number};
const SAVE='marion-lucas-save-v4';
const UI='marion-ui-prototype-v1';
const load=():DemoState=>{try{return {...{tool:null,phoneView:'home',selected:null,place:'Chez Marion',time:'09:12',memories:[],beat:'morning',metDominic:false,year:1998,hasDominicNumber:false,contactStage:0,day:1},...JSON.parse(localStorage.getItem(UI)||'{}')}}catch{return {tool:null,phoneView:'home',selected:null,place:'Chez Marion',time:'09:12',memories:[],beat:'morning',metDominic:false,year:1998,hasDominicNumber:false,contactStage:0,day:1}}};
const state=load(); const persist=()=>localStorage.setItem(UI,JSON.stringify(state));
function mount(){
 const app=document.getElementById('app');if(!app)return;document.getElementById('newGameShell')?.remove();
 const old=[...app.children] as HTMLElement[];old.forEach(x=>x.style.display='none');
 let game:any={};try{game=JSON.parse(localStorage.getItem(SAVE)||'{}')}catch{}
 const root=document.createElement('div');root.id='newGameShell';root.className='ng-shell';
 root.innerHTML=`<div class="ng-scene"><div class="ng-media"><video id="ngSceneVideo" playsinline muted loop hidden></video><img id="ngSceneImage" alt="" hidden><div class="ng-media-shade"></div><span id="ngSceneTitle">MARION · SCÈNE DE VIE</span><small id="ngSceneSub">média canonique connecté ensuite par MonIA</small></div><div class="ng-cinematic" hidden><small></small><strong></strong><span></span></div></div>
 <header class="ng-top"><div class="ng-id"><b>Marion</b><span>Nîmes · JOUR <i id="ngDay">${state.day}</i> · <i id="ngYear">${state.year}</i> · <i id="ngTime">${state.time}</i></span></div><nav>
 <button data-tool="phone">☎<small>Téléphone</small><i class="badge">${game.phoneUnread||1}</i></button>
 <button data-tool="agenda">▦<small>Agenda</small></button><button data-tool="map">⌖<small>Carte</small></button><button data-tool="memories">✦<small>Souvenirs</small></button></nav></header>
 <div class="ng-toast" hidden></div><div class="ng-interrupt" hidden></div><section class="ng-now"><p>QU’EST-CE QUE TU FAIS MAINTENANT ?</p><div class="ng-choices" id="ngChoices"></div></section>
 <aside class="ng-panel" hidden><button class="ng-close">×</button><div class="ng-panel-body"></div></aside>`;
 app.appendChild(root);
 const panel=root.querySelector('.ng-panel') as HTMLElement,body=root.querySelector('.ng-panel-body') as HTMLElement,toast=root.querySelector('.ng-toast') as HTMLElement;
 const interrupt=root.querySelector('.ng-interrupt') as HTMLElement;
 const cinematic=root.querySelector('.ng-cinematic') as HTMLElement;
 const sceneTitle=root.querySelector('#ngSceneTitle') as HTMLElement,sceneSub=root.querySelector('#ngSceneSub') as HTMLElement;
 const sceneVideo=root.querySelector('#ngSceneVideo') as HTMLVideoElement,sceneImage=root.querySelector('#ngSceneImage') as HTMLImageElement;
 const setMedia=(media:any)=>{if(!media)return;const src=typeof media==='string'?media:media.src||media.url;if(!src)return;const type=(typeof media==='object'&&media.type)||(/\.(mp4|webm)(\?|$)/i.test(src)?'video':'image');sceneVideo.pause();sceneVideo.hidden=true;sceneImage.hidden=true;if(type==='video'){sceneVideo.src=src;sceneVideo.hidden=false;sceneVideo.play().catch(()=>{})}else{sceneImage.src=src;sceneImage.hidden=false}};
 const syncRuntimeMedia=()=>{const r=runtime();setMedia(r.scene?.media||r.media||r.currentMedia)};
 const setScene=(title:string,sub:string)=>{sceneTitle.textContent=title;sceneSub.textContent=sub};
 const eventBeat=(kicker:string,title:string,sub:string,after?:()=>void)=>{state.tool=null;panel.hidden=true;root.classList.add('event-mode');choices.classList.add('waiting');cinematic.hidden=false;(cinematic.querySelector('small') as HTMLElement).textContent=kicker;(cinematic.querySelector('strong') as HTMLElement).textContent=title;(cinematic.querySelector('span') as HTMLElement).textContent=sub;setTimeout(()=>{cinematic.hidden=true;root.classList.remove('event-mode');choices.classList.remove('waiting');after?.()},1800)};
 const say=(x:string)=>{toast.textContent=x;toast.hidden=false;setTimeout(()=>toast.hidden=true,1800)};
 const worldInitiative=()=>{if(!state.hasDominicNumber||state.contactStage>1)return;state.contactStage=2;persist();const variant=(Math.abs((game.seed||17)+state.memories.length)%2);if(variant===0){incoming('Dominic')}else{state.memories.unshift('Dominic a envoyé son premier message.');say('Nouveau message de Dominic : « Tu es bien rentrée ? »');state.tool='phone';persist();renderPanel()}};
 const incoming=(name:string)=>{interrupt.hidden=false;interrupt.innerHTML='<small>APPEL ENTRANT</small><strong>'+name+'</strong><span>Le monde peut venir jusqu’à toi.</span><div><button data-answer>Décrocher</button><button data-later>Plus tard</button></div>';interrupt.querySelector('[data-answer]')?.addEventListener('click',()=>{interrupt.hidden=true;state.tool='phone';state.phoneView='call';persist();body.innerHTML='<em>APPEL EN COURS</em><h2>'+name+'</h2><div class="ng-callface"><span>VIDÉO / VOIX DU PERSONNAGE</span></div><div class="ng-inline"><button data-tone="listen">Écouter</button><button data-tone="tease">Le taquiner</button><button data-tone="ask">Poser une question</button></div>';panel.hidden=false;body.querySelectorAll('[data-tone]').forEach(b=>b.addEventListener('click',()=>{state.memories.unshift('Un appel avec '+name+' · '+(b as HTMLElement).textContent);persist();say('MonIA retient la manière dont tu as vécu cet appel.')}))});interrupt.querySelector('[data-later]')?.addEventListener('click',()=>{interrupt.hidden=true;state.memories.unshift('Tu as laissé sonner '+name+'.');persist();say(name+' continue sa vie, même sans réponse.')})};
 const emit=(intent:string,extra:any={})=>window.dispatchEvent(new CustomEvent('marion:player-intent',{detail:{intent,place:state.place,beat:state.beat,day:state.day,year:state.year,memories:[...state.memories],hasDominicNumber:state.hasDominicNumber,...extra}}));
 const runtime=()=>((window as any).MONIA_GAMEPLAY_STATE||(window as any).marionGameplayState||{});
 const open=(tool:Tool)=>{state.tool=tool;root.classList.toggle('tool-open',!!tool);persist();renderPanel()};
 const choices=root.querySelector('#ngChoices') as HTMLElement;
 const hasTease=()=>state.memories.some(x=>x.includes('taquiner'));
 const engineChoices=()=>{const runtime=(window as any).MONIA_GAMEPLAY_STATE||(window as any).marionGameplayState;const list=runtime?.choices||runtime?.proposals||runtime?.intents;return Array.isArray(list)?list.map((x:any)=>[String(x.id||x.intent||x.key),String(x.label||x.text||x.title)]):null};
 const choiceSets:any={
 morning:[['marine','Répondre à Marine'],['prepare','Finir de te préparer'],['leave','Sortir maintenant']],
 ready:[['agenda','Regarder ce qui est prévu'],['leave','Partir maintenant'],['wait','Prendre encore quelques minutes']],
 outside:[['centre','Aller vers le centre'],['arena','Passer par les Arènes'],['marine','Retrouver Marine']],
 encounter:[['look','Soutenir son regard'],['smile','Lui sourire'],['continue','Continuer ton chemin']],
 afterMeet:[['number','Échanger vos numéros'],['marine','Rejoindre Marine'],['leaveMeet','Le laisser repartir']],
 later:[['day','Continuer ta journée'],['phone','Regarder ton téléphone'],['agenda','Voir ce qui est prévu']],
 evening:[['home','Rentrer chez toi'],['stay','Rester encore un peu'],['phone','Regarder ton téléphone']],
 night:[['sleep','Aller dormir'],['memory','Repenser à la journée'],['phone','Regarder ton téléphone']],
 day2:[['agenda','Voir ta journée'],['phone','Regarder ton téléphone'],['outside2','Commencer la journée']]
 };
 const renderChoices=()=>{let set=engineChoices()||[...(choiceSets[state.beat]||choiceSets.morning)];root.classList.toggle('has-decisions',set.length>0);if(state.metDominic&&hasTease()&&state.beat==='outside')set.unshift(['echo','Reprendre votre petite blague']);choices.innerHTML=set.map((x:any)=>'<button data-dynamic="'+x[0]+'">'+x[1]+'</button>').join('');choices.querySelectorAll('[data-dynamic]').forEach(b=>b.addEventListener('click',()=>act((b as HTMLElement).dataset.dynamic!)))};
 const act=(intent:string)=>{
  choices.classList.add('committed');setTimeout(()=>choices.classList.remove('committed'),420);
  choices.querySelectorAll('button').forEach(x=>x.classList.toggle('chosen',(x as HTMLElement).dataset.dynamic===intent));
  if(intent==='marine'){open('phone');}
  else if(intent==='prepare'){state.beat='ready';state.time='09:28';say('Marion termine de se préparer.');}
  else if(intent==='agenda'){open('agenda');}
  else if(intent==='wait'){state.time='09:41';say('Le temps passe. Les autres continuent leur journée.');}
  else if(intent==='leave'){state.beat='outside';state.place='Centre-ville';state.time='09:46';setScene('NÎMES · EXTÉRIEUR','Marion vient de quitter son appartement.');eventBeat('CONSÉQUENCE','Marion sort.','Le choix devient immédiatement une action.');}
  else if(intent==='echo'){say('Marion reprend naturellement un détail de votre dernier appel.');state.memories.unshift('Une private joke est devenue un petit rituel.');}
  else if(intent==='centre'){state.place='Centre-ville';state.time='10:02';say('Tu vas vers le centre.');}
  else if(intent==='arena'){state.place='Arènes';state.time='10:06';state.beat='encounter';setScene('NÎMES · PRÈS DES ARÈNES','La foule continue de vivre autour de Marion.');eventBeat('ÉVÉNEMENT DU MONDE','Quelqu’un attire ton attention…','Tu ne l’as pas déclenché.',()=>renderChoices());}
  else if(intent==='look'||intent==='smile'||intent==='continue'){state.metDominic=true;setScene('PREMIÈRE RENCONTRE','Dominic existe dans la scène indépendamment de tes choix.');state.memories.unshift(intent==='continue'?'Une première rencontre à peine esquissée.':'Un premier échange de regards près des Arènes.');state.beat='afterMeet';eventBeat('RENCONTRE','Le moment passe.','Tu peux ouvrir une porte, pas décider de ce qu’il fera ensuite.',()=>renderChoices());}
  else if(intent==='number'){state.hasDominicNumber=true;state.contactStage=1;state.beat='later';state.time='10:24';state.memories.unshift('Marion et Dominic ont échangé leurs numéros.');eventBeat('UN PETIT DÉTAIL','Vos numéros sont échangés.','Puis chacun reprend sa journée.',()=>{renderChoices();setTimeout(()=>worldInitiative(),2600)});}
  else if(intent==='leaveMeet'){state.beat='later';state.time='10:20';eventBeat('LE MONDE CONTINUE','Dominic repart.','Cette rencontre existe même si Marion ne la poursuit pas.',()=>renderChoices());}
  else if(intent==='day'){if(state.time<'18:00'){state.time='18:42';state.beat='evening';say('La journée avance. Les personnages aussi.');if(state.hasDominicNumber)setTimeout(()=>worldInitiative(),1600)}else{state.beat='evening';} }
  else if(intent==='home'){state.place='Chez Marion';state.time='22:16';state.beat='night';setScene('CHEZ MARION · SOIR','La journée existe maintenant dans ta mémoire.');eventBeat('FIN DE JOURNÉE','Marion rentre chez elle.','Ce qui a eu lieu aujourd’hui restera vrai demain.',()=>renderChoices());}
  else if(intent==='stay'){state.time='21:03';say('Tu restes encore un peu. Le temps ne t’attend pas.');}
  else if(intent==='memory'){open('memories');}
  else if(intent==='sleep'){state.day+=1;state.time='08:37';state.place='Chez Marion';state.beat='day2';state.tool=null;setScene('CHEZ MARION · MATIN','Une nouvelle journée commence à partir de ce que tu as vécu.');state.memories.unshift('Jour '+(state.day-1)+' terminé.');eventBeat('JOUR '+state.day,'Le lendemain matin.','Rien n’a été remis à zéro.',()=>renderChoices());}
  else if(intent==='outside2'){state.place='Nîmes';state.time='09:10';state.beat='later';setScene('NÎMES · NOUVELLE JOURNÉE','Les engagements et relations continuent.');say('Tu reprends ta vie là où elle en est.');}
  else if(intent==='phone'){open('phone');}
  (root.querySelector('#ngTime') as HTMLElement).textContent=state.time;(root.querySelector('#ngDay') as HTMLElement).textContent=String(state.day);persist();renderChoices();emit(intent);
 };
 function renderPanel(){if(!state.tool){panel.hidden=true;root.classList.remove('tool-open');return}panel.hidden=false;panel.dataset.tool=state.tool||'';panel.classList.toggle('era-1998',state.tool==='phone'&&state.year<2001);panel.classList.toggle('era-modern',state.tool==='phone'&&state.year>=2010);
  if(state.tool==='phone'){const era=state.year<2001?'APPELS · SMS':state.year<2008?'SMS · CONTACTS · APPELS':state.year<2014?'SMARTPHONE · PHOTOS · MESSAGES':'MESSAGES · PHOTOS · VISIO'; body.innerHTML=`<div class="ng-device"><div class="ng-device-screen"><em>TÉLÉPHONE · ${state.year}</em><h2>${state.year<2001?'MARION':'Téléphone'}</h2><p class="ng-era">${era}</p><div class="ng-tabs"><button data-phone="messages">Messages</button><button data-phone="call">Appels</button><button>Contacts</button></div><article class="ng-thread" data-phone="messages"><b>Marine</b><span>Tu es où ?</span><small>maintenant</small></article><article><b>Dominic</b><span>${state.hasDominicNumber?'Dans vos contacts':state.metDominic?'Rencontré aujourd’hui · aucun numéro':'Vous ne vous connaissez pas encore.'}</span></article></div><div class="ng-device-keys"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;}
  if(state.tool==='agenda'){const a=runtime().agenda; body.innerHTML=`<div class="ng-paper"><em>AGENDA · JOUR ${state.day}</em><h2>Ma journée</h2>${state.day===1?'<article><b>10:30 · Retrouver Marine</b><span>Centre-ville</span>':'<article><b>Matin · Temps pour toi</b><span>Nîmes</span>'}<div class="ng-inline"><button data-agenda="go">Y aller</button><button data-agenda="warn">Prévenir</button><button data-agenda="ignore">Continuer ici</button></div></article><article><b>Après-midi</b><span>Temps libre</span></article><article><b>Soirée</b><span>${a?.evening||'Rien de prévu… pour l’instant.'}</span></article></div>`;}
  if(state.tool==='map'){const places=runtime().places; body.innerHTML=`<div class="ng-mapcard"><em>CARTE · NÎMES</em><h2>Où aller ?</h2><div class="ng-map"><span class="road r1"></span><span class="road r2"></span><button class="pin home" data-place="Chez Marion">⌂<small>Chez Marion</small></button><button class="pin centre" data-place="Centre-ville">●<small>Centre</small></button><button class="pin arena" data-place="Arènes">●<small>Arènes</small></button></div><p class="ng-rule">Tu es actuellement : <b>${state.place}</b>. Tu choisis un lieu, jamais l’événement qui t’y attend.</p>${Array.isArray(places)?'<p class="ng-worldhint">'+places.length+' lieux actuellement compatibles avec cette partie.</p>':''}</div>`;}
  if(state.tool==='memories'){const rel=runtime().relationship; body.innerHTML=`<em>VOTRE HISTOIRE</em><h2>Souvenirs</h2><p class="ng-rule">Pas de jauge d’amour. MonIA retient ce qui a réellement été vécu.</p><div class="ng-memory">${state.memories.length?state.memories.map(x=>'<article><b>'+x+'</b><span>Ce moment peut réapparaître naturellement plus tard.</span></article>').join(''):'<article><b>Votre histoire commence ici.</b><span>Les souvenirs importants apparaîtront au fil de la partie.</span></article>'}</div>${rel?.summary?'<p class="ng-worldhint">'+rel.summary+'</p>':''}`;}
  bindPanel();
 }
 function bindPanel(){body.querySelectorAll('[data-phone="messages"]').forEach(x=>x.addEventListener('click',()=>{body.innerHTML=`<em>MARINE · EN LIGNE</em><h2>Messages</h2><div class="ng-chat"><p>Marine <span>Tu es où ?</span></p><p class="me">Marion <span>Je finis de me préparer.</span></p><p>Marine <span>Dépêche-toi 😄</span></p></div><div class="ng-inline"><button data-reply>Répondre</button><button data-close-chat>Revenir au jeu</button></div>`;body.querySelector('[data-reply]')?.addEventListener('click',()=>say('Marion répond naturellement à Marine'));body.querySelector('[data-close-chat]')?.addEventListener('click',()=>{state.tool=null;persist();renderPanel()})}));
  body.querySelectorAll('[data-agenda]').forEach(x=>x.addEventListener('click',()=>{const a=(x as HTMLElement).dataset.agenda;if(a==='go'){state.place='Centre-ville';state.time='10:12';(root.querySelector('#ngTime') as HTMLElement).textContent=state.time;say('Marion se prépare à partir — le monde continue.')}else if(a==='warn')say('Marine est prévenue.');else say('Tu restes ici. Le rendez-vous, lui, existe toujours.');persist()}));
  body.querySelectorAll('[data-place]').forEach(x=>x.addEventListener('click',()=>{state.place=(x as HTMLElement).dataset.place||state.place;state.tool=null;persist();renderPanel();say('Destination : '+state.place+' — MonIA décide ce qui peut s’y passer.');window.dispatchEvent(new CustomEvent('marion:destination',{detail:{place:state.place,day:state.day,year:state.year}}));emit('travel',{destination:state.place})}));
 }
 root.querySelectorAll('[data-tool]').forEach(x=>x.addEventListener('click',()=>open((x as HTMLElement).dataset.tool as Tool)));
 root.querySelector('.ng-close')?.addEventListener('click',()=>{state.tool=null;persist();renderPanel()});
 const dev=document.createElement('button');dev.className='ng-timejump';dev.textContent='APERÇU DES ANNÉES ›';dev.onclick=()=>{state.year=state.year===1998?2003:state.year===2003?2010:state.year===2010?2016:1998;(root.querySelector('#ngYear') as HTMLElement).textContent=String(state.year);persist();say('Le monde et les outils évoluent avec l’époque : '+state.year);if(state.tool==='phone')renderPanel()};root.appendChild(dev);
 root.addEventListener('ng:refresh',()=>{syncRuntimeMedia();renderChoices();renderPanel()});
 window.addEventListener('monia:scene',((e:CustomEvent)=>{const d=e.detail||{};if(d.title)setScene(d.title,d.subtitle||'');if(d.media)setMedia(d.media);if(d.time){state.time=d.time;(root.querySelector('#ngTime') as HTMLElement).textContent=state.time}if(d.place)state.place=d.place;persist()}) as EventListener);
 syncRuntimeMedia();
 renderChoices();
 renderPanel();
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(mount,80));setTimeout(mount,600);

window.addEventListener('monia:gameplay-state',()=>{const r=document.getElementById('newGameShell');if(r){const e=new Event('ng:refresh');r.dispatchEvent(e)}});
