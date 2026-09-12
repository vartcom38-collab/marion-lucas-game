import { moniaCreativeVault } from './creative-vault';

const BOOTSTRAP_KEY='monia-asset-bootstrap-v2';
const LEGACY_BAD_VISIO_ID='asset-lucas-visio-canonical-fallback';

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
  }
];

export async function ensureMonIAAssetBootstrap(){
  const legacy=await moniaCreativeVault.approvedAssets({kind:'visio',actor:'Lucas',role:'fallback'}).catch(()=>[]);
  if(legacy.some(x=>x.id===LEGACY_BAD_VISIO_ID))await moniaCreativeVault.updateAsset(LEGACY_BAD_VISIO_ID,{status:'rejected',metadata:{canonical:false,liveAllowed:false,rejectedReason:'legacy candidate path cannot be live'}}).catch(()=>null);
  try{if(localStorage.getItem(BOOTSTRAP_KEY)==='1')return}catch{}
  for(const asset of APPROVED_ASSETS){
    const existing=await moniaCreativeVault.approvedAssets({kind:asset.kind,actor:asset.actor,role:asset.role}).catch(()=>[]);
    if(existing.some(x=>x.id===asset.id))continue;
    await moniaCreativeVault.registerAsset(asset);
  }
  try{localStorage.setItem(BOOTSTRAP_KEY,'1')}catch{}
}
