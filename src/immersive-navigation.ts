import './immersiveNavigation.css';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';

let engine:Engine|null=null;
let mountedStage:HTMLElement|null=null;
let refreshTimer=0;

function dispose(){
  engine?.dispose();
  engine=null;
  mountedStage=null;
}

function material(scene:Scene,name:string,color:Color3){
  const m=new StandardMaterial(name,scene);
  m.diffuseColor=color;
  m.specularColor=new Color3(.08,.08,.08);
  return m;
}

function box(scene:Scene,name:string,w:number,h:number,d:number,pos:Vector3,mat:StandardMaterial,action?:string){
  const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
  mesh.position=pos;
  mesh.material=mat;
  if(action)mesh.metadata={action};
  return mesh;
}

function mount(stage:HTMLElement){
  if(mountedStage===stage&&engine)return;
  dispose();
  mountedStage=stage;
  stage.classList.add('live3DHome');

  const oldCanvas=stage.querySelector<HTMLCanvasElement>('#immersiveHome3D');
  oldCanvas?.remove();
  const canvas=document.createElement('canvas');
  canvas.id='immersiveHome3D';
  canvas.setAttribute('aria-label','Appartement 3D interactif de Marion à Nîmes');
  stage.prepend(canvas);

  const e=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,antialias:true});
  engine=e;
  const scene=new Scene(e);
  scene.clearColor=new Color4(.10,.085,.07,1);
  scene.ambientColor=new Color3(.34,.31,.27);

  const camera=new ArcRotateCamera('homeCamera',-Math.PI/2.35,1.12,8.8,new Vector3(0,1.15,.45),scene);
  camera.lowerRadiusLimit=6.6;
  camera.upperRadiusLimit=10.6;
  camera.lowerBetaLimit=.78;
  camera.upperBetaLimit=1.38;
  camera.wheelPrecision=90;
  camera.panningSensibility=0;
  camera.inertia=.78;
  camera.attachControl(canvas,true);

  const hemi=new HemisphericLight('ambient',new Vector3(0,1,0),scene);
  hemi.intensity=.8;
  hemi.diffuse=new Color3(1,.91,.79);
  hemi.groundColor=new Color3(.22,.18,.15);
  const sun=new DirectionalLight('morningLight',new Vector3(-.5,-1,.55),scene);
  sun.position=new Vector3(4,6,-4);
  sun.intensity=1.25;
  sun.diffuse=new Color3(1,.79,.58);

  const wall=material(scene,'warmPlaster',new Color3(.72,.64,.55));
  const oak=material(scene,'oakFloor',new Color3(.33,.21,.13));
  const linen=material(scene,'linen',new Color3(.63,.57,.49));
  const dark=material(scene,'darkWood',new Color3(.13,.085,.055));
  const stone=material(scene,'stone',new Color3(.52,.48,.42));
  const metal=material(scene,'metal',new Color3(.07,.065,.06));
  const green=material(scene,'green',new Color3(.12,.24,.11));
  const rug=material(scene,'rug',new Color3(.43,.35,.28));

  box(scene,'floor',10,.16,7,new Vector3(0,-.08,.2),oak);
  box(scene,'backWall',10,3.25,.16,new Vector3(0,1.62,3.65),wall);
  box(scene,'leftWall',.16,3.25,7,new Vector3(-5,1.62,.2),wall);
  box(scene,'rightWall',.16,3.25,7,new Vector3(5,1.62,.2),wall);

  box(scene,'sofaSeat',3.2,.48,1.05,new Vector3(-1.85,.42,1.55),linen,'sofa');
  box(scene,'sofaBack',3.2,.82,.22,new Vector3(-1.85,.9,2.02),linen,'sofa');
  box(scene,'sofaArmL',.28,.68,1.05,new Vector3(-3.31,.62,1.55),linen,'sofa');
  box(scene,'sofaArmR',.28,.68,1.05,new Vector3(-.39,.62,1.55),linen,'sofa');
  box(scene,'rug',4,.03,2.7,new Vector3(-1.55,.03,-.05),rug);
  box(scene,'coffeeTable',1.75,.11,.8,new Vector3(-1.5,.42,.12),dark);
  for(const x of [-2.1,-.9])for(const z of [-.16,.4])box(scene,'leg'+x+z,.09,.72,.09,new Vector3(x,.2,z),metal);

  box(scene,'kitchenIsland',2.8,.92,1.05,new Vector3(2.6,.46,.5),stone,'breakfast');
  box(scene,'islandTop',2.95,.08,1.16,new Vector3(2.6,.96,.5),dark,'breakfast');
  for(let i=0;i<3;i++)box(scene,'cab'+i,.84,.85,.55,new Vector3(1.72+i*.9,.43,3.26),dark,'breakfast');
  box(scene,'diningTop',1.95,.1,1.2,new Vector3(1.65,.78,-1.52),dark,'breakfast');
  for(const x of [.95,2.35])for(const z of [-1.9,-1.15])box(scene,'diningLeg'+x+z,.1,.72,.1,new Vector3(x,.37,z),metal);

  const glass=material(scene,'window',new Color3(.35,.48,.55));
  glass.alpha=.22;
  const balcony=box(scene,'balconyGlass',2.3,2.45,.05,new Vector3(.52,1.45,3.5),glass,'balcony');
  balcony.visibility=.5;
  box(scene,'frameL',.07,2.55,.08,new Vector3(-.62,1.45,3.47),metal);
  box(scene,'frameR',.07,2.55,.08,new Vector3(1.66,1.45,3.47),metal);
  box(scene,'frameT',2.35,.07,.08,new Vector3(.52,2.7,3.47),metal);

  box(scene,'plantPot',.48,.46,.48,new Vector3(4.05,.24,2.65),stone);
  box(scene,'plantStem',.1,1.12,.1,new Vector3(4.05,.91,2.65),dark);
  const leaves:Mesh[]=[];
  for(let i=0;i<7;i++){
    const leaf=MeshBuilder.CreateSphere('leaf'+i,{diameter:.62,segments:8},scene);
    leaf.position=new Vector3(4.05+Math.cos(i*1.7)*.32,1.35+(i%3)*.18,2.65+Math.sin(i*1.7)*.28);
    leaf.scaling.y=.5;
    leaf.material=green;
    leaves.push(leaf);
  }

  scene.onPointerDown=(_,pick)=>{
    const action=pick?.pickedMesh?.metadata?.action as string|undefined;
    if(!action)return;
    const target=stage.querySelector<HTMLElement>(`[data-home-action="${action}"]`);
    target?.click();
  };

  const started=performance.now();
  e.runRenderLoop(()=>{
    const t=(performance.now()-started)/1000;
    leaves.forEach((leaf,i)=>{leaf.rotation.z=Math.sin(t*.7+i)*.035;leaf.position.y+=Math.sin(t*.55+i)*.00008});
    scene.render();
  });

  const resize=()=>e.resize();
  window.addEventListener('resize',resize,{passive:true});
  const observer=new MutationObserver(()=>{
    if(!stage.isConnected){window.removeEventListener('resize',resize);observer.disconnect();dispose()}
  });
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
}

function refresh(){
  if(refreshTimer)window.clearTimeout(refreshTimer);
  refreshTimer=window.setTimeout(()=>{
    const stage=document.querySelector<HTMLElement>('.immersivePlayable .homePhotoStage');
    if(stage)mount(stage);else if(mountedStage)dispose();
  },60);
}

new MutationObserver(refresh).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
refresh();
