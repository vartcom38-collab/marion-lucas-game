import { moniaCreativeVault } from './creative-vault';

const BOOTSTRAP_KEY='monia-asset-bootstrap-v1';

const APPROVED_ASSETS=[
  {
    id:'asset-home-apartment-nimes',
    kind:'decor' as const,
    actor:'Marion',
    role:'home',
    url:'/resources/appartement-nimes.png',
    status:'approved' as const,
    source:'reference' as const,
    tags:['nimes','appartement','home','day1','photorealistic'],
    metadata:{canonical:true,liveAllowed:true}
  },
  {
    id:'asset-lucas-visio-canonical-fallback',
    kind:'visio' as const,
    actor:'Lucas',
    role:'fallback',
    url:'/resources/monia/generated/intro-lucas-candidate-desktop.mp4',
    status:'approved' as const,
    source:'reference' as const,
    tags:['lucas','visio','fallback','desktop','canonical'],
    metadata:{canonical:true,liveAllowed:true,approvedManifest:'config/monia-visio-approved.json'}
  }
];

export async function ensureMonIAAssetBootstrap(){
  try{if(localStorage.getItem(BOOTSTRAP_KEY)==='1')return}catch{}
  for(const asset of APPROVED_ASSETS){
    const existing=await moniaCreativeVault.approvedAssets({kind:asset.kind,actor:asset.actor,role:asset.role}).catch(()=>[]);
    if(existing.some(x=>x.id===asset.id))continue;
    await moniaCreativeVault.registerAsset(asset);
  }
  try{localStorage.setItem(BOOTSTRAP_KEY,'1')}catch{}
}
