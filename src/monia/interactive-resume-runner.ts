import { readInteractiveScene, markInteractiveSceneMaterializing, attachInteractiveMedia, failInteractiveScene, pauseForChoice, continuityPrompt, type MonIAInteractiveScene } from './interactive-scene';

let busy=false;

function asChoices(raw:unknown){
  if(!Array.isArray(raw))return [];
  return raw.slice(0,3).map((label,index)=>({id:`branch-${index+1}`,label:String(label),intent:String(label)}));
}

async function resumeFromInput(detail:{sceneId?:string;choiceId?:string;freeText?:string}){
  if(busy)return;
  const current=readInteractiveScene();
  if(!current||current.state!=='awaiting-choice'||(detail.sceneId&&detail.sceneId!==current.id))return;
  const baseRequest=current.experience.requestSnapshot;
  if(!baseRequest){failInteractiveScene(current,'Contexte interactif d’origine indisponible');return;}
  busy=true;
  try{
    const { moniaRuntime }=await import('./runtime');
    const resumed=await moniaRuntime.resumeInteractiveScene(current,{choiceId:detail.choiceId,freeText:detail.freeText},baseRequest);
    let scene=markInteractiveSceneMaterializing(resumed.interactiveScene);

    const [{ buildAutonomousMediaPlan },{ buildMonIAGenerationJob },{ moniaExperience }]=await Promise.all([
      import('./media-orchestrator'),
      import('./generation-job'),
      import('./experience-runtime'),
    ]);

    const request=scene.experience.requestSnapshot||baseRequest;
    const authority=continuityPrompt(scene.continuity);
    const response={
      ...resumed.response,
      scene:resumed.response.scene?{...resumed.response.scene,action:`${resumed.response.scene.action}. ${authority}`} : resumed.response.scene,
    };
    const mediaPlan=buildAutonomousMediaPlan(response,request.context);
    const generationJob=buildMonIAGenerationJob(response,mediaPlan,{...request,playerText:`${request.playerText||''} ${authority}`.trim()});
    scene={...scene,experience:{...scene.experience,response,mediaPlan,generationJob,requestSnapshot:request}};

    const media=await moniaExperience.materialize({response,mediaPlan,generationJob});
    if(media.state==='voice-failed'||media.state==='image-failed'||media.state==='video-failed'){
      failInteractiveScene(scene,`La suite n’a pas pu être matérialisée (${media.state})`);return;
    }

    scene=attachInteractiveMedia(scene,media.videoUrl||media.imageUrl);
    window.dispatchEvent(new CustomEvent('monia-interactive-media-ready',{detail:{scene,media,response,dramaPlan:resumed.dramaPlan}}));

    const nextChoices=asChoices(resumed.dramaPlan?.choices);
    if(nextChoices.length){
      window.setTimeout(()=>pauseForChoice(scene,nextChoices),Math.max(900,Number(response.scene?.duration||5)*1000));
    }
  }catch(error){
    const scene=readInteractiveScene();
    if(scene)failInteractiveScene(scene,error instanceof Error?error.message:String(error));
  }finally{busy=false;}
}

window.addEventListener('monia-interactive-player-input',event=>{void resumeFromInput((event as CustomEvent).detail||{})});
console.info('[MonIA] Interactive resume runner active · click/free response → same scene → media materialization → next decision');
