import { monia, type MonIAMode, type MonIADirectorRequest, type MonIADirectorResult } from './runtime';
import { buildAutonomousMediaPlan, type MonIAMediaPlan } from './media-orchestrator';

export type MonIAExperienceResult = {
  response: MonIADirectorResult;
  mediaPlan: MonIAMediaPlan;
};

export class MonIAExperienceRuntime {
  async respond(request:MonIADirectorRequest, mode:MonIAMode='auto', enabled=true):Promise<MonIAExperienceResult>{
    const response=await monia.direct(request,mode,enabled);
    const mediaPlan=buildAutonomousMediaPlan(response,request.context);
    return {response,mediaPlan};
  }
}

export const moniaExperience=new MonIAExperienceRuntime();
