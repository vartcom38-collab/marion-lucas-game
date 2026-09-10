export type VisioVariationInput={
  state:'listening'|'speaking'|'reaction'|'thinking';
  mood?:string;
  place?:string;
  timeOfDay?:string;
  relationship?:string;
  recentBeat?:string;
};

const framings=[
  'close front-camera framing, shoulders visible, phone held steady at eye level',
  'slightly wider front-camera framing, subtle natural lean toward the phone',
  'gentle three-quarter angle before returning gaze to camera',
  'relaxed seated framing with a tiny handheld imperfection, never a dramatic camera move'
];

const lightings=[
  'soft warm practical lamp light with natural skin texture',
  'neutral late-afternoon window light mixed with soft indoor ambience',
  'quiet evening light with warm background bokeh and realistic face exposure',
  'soft morning daylight with subdued interior contrast'
];

const backgrounds=[
  'lived-in apartment background, softly blurred, no repeated hero composition',
  'simple domestic interior with one practical lamp and understated decor',
  'quiet room background with depth and small natural imperfections',
  'minimal home interior with soft depth of field and no staged fashion-shoot feeling'
];

const microActions=[
  'brief gaze shift toward the screen, then back to camera',
  'small breath and almost imperceptible head adjustment',
  'one natural blink cluster separated by a longer attentive gaze',
  'tiny posture reset in the shoulders before settling again'
];

function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function pick<T>(items:T[],seed:number,offset:number){return items[(seed+offset)%items.length]}

export function buildVisioVariation(input:VisioVariationInput){
  const signature=[input.state,input.mood,input.place,input.timeOfDay,input.relationship,input.recentBeat].filter(Boolean).join('|');
  const seed=hash(signature||input.state);
  return {
    signature:`visio-${seed.toString(36)}`,
    framing:pick(framings,seed,0),
    lighting:pick(lightings,seed,1),
    background:pick(backgrounds,seed,2),
    microAction:pick(microActions,seed,3)
  };
}
