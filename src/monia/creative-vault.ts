export type MonIAAssetKind='image'|'video'|'voice'|'decor'|'wardrobe'|'visio'|'other';
export type MonIAAssetStatus='candidate'|'approved'|'rejected';
export type MonIAAsset={
  id:string;
  kind:MonIAAssetKind;
  actor?:string;
  role?:string;
  url:string;
  status:MonIAAssetStatus;
  tags:string[];
  source:'generated'|'reference'|'imported';
  createdAt:number;
  updatedAt:number;
  useCount:number;
  metadata?:Record<string,string|number|boolean|null>;
};

export type MonIACanonRecord={
  id:string;
  scope:'global'|'character'|'place'|'relationship'|'rule';
  subject:string;
  text:string;
  locked:boolean;
  updatedAt:number;
};

export type MonIAGenerationRecord={
  id:string;
  kind:'text'|'image'|'video'|'voice';
  actor?:string;
  promptKey:string;
  resultUrl?:string;
  resultText?:string;
  reusedAssetId?:string;
  status:'generated'|'reused'|'rejected';
  createdAt:number;
};

const DB_NAME='monia-creative-vault';
const DB_VERSION=1;

function norm(value:string){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function unique(values:string[]){return [...new Set(values.map(norm).filter(Boolean))]}

class CreativeVault{
  private dbPromise:Promise<IDBDatabase>|null=null;
  private db(){
    if(this.dbPromise)return this.dbPromise;
    this.dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'id'});
        if(!db.objectStoreNames.contains('canon'))db.createObjectStore('canon',{keyPath:'id'});
        if(!db.objectStoreNames.contains('generations'))db.createObjectStore('generations',{keyPath:'id'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    return this.dbPromise;
  }

  private async all<T>(store:string){
    const db=await this.db();
    return new Promise<T[]>((resolve,reject)=>{
      const tx=db.transaction(store,'readonly');
      const req=tx.objectStore(store).getAll();
      req.onsuccess=()=>resolve(req.result as T[]);
      req.onerror=()=>reject(req.error);
    });
  }

  private async put<T>(store:string,value:T){
    const db=await this.db();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(store,'readwrite');
      tx.objectStore(store).put(value as any);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
    });
  }

  async putCanon(record:Omit<MonIACanonRecord,'updatedAt'>){await this.put('canon',{...record,updatedAt:Date.now()})}
  async canon(){return (await this.all<MonIACanonRecord>('canon')).sort((a,b)=>Number(b.locked)-Number(a.locked)||b.updatedAt-a.updatedAt)}

  async registerAsset(input:Omit<MonIAAsset,'createdAt'|'updatedAt'|'useCount'|'tags'> & {tags?:string[]}){
    const now=Date.now();
    const asset:MonIAAsset={...input,tags:unique(input.tags||[]),createdAt:now,updatedAt:now,useCount:0};
    await this.put('assets',asset);return asset;
  }

  async updateAsset(id:string,patch:Partial<Pick<MonIAAsset,'status'|'tags'|'role'|'url'|'metadata'>>){
    const assets=await this.all<MonIAAsset>('assets');const current=assets.find(x=>x.id===id);if(!current)return null;
    const next:MonIAAsset={...current,...patch,tags:patch.tags?unique(patch.tags):current.tags,updatedAt:Date.now()};
    await this.put('assets',next);return next;
  }

  async assets(query:{status?:MonIAAssetStatus;kind?:MonIAAssetKind;actor?:string;role?:string;tags?:string[]}={}){
    const tags=unique(query.tags||[]),actor=norm(query.actor||''),role=norm(query.role||'');
    return (await this.all<MonIAAsset>('assets')).filter(asset=>{
      if(query.status&&asset.status!==query.status)return false;
      if(query.kind&&asset.kind!==query.kind)return false;
      if(actor&&norm(asset.actor||'')!==actor)return false;
      if(role&&norm(asset.role||'')!==role)return false;
      const own=new Set(asset.tags.map(norm));
      return tags.every(tag=>own.has(tag));
    }).sort((a,b)=>b.updatedAt-a.updatedAt||b.useCount-a.useCount);
  }

  async approvedAssets(query:{kind?:MonIAAssetKind;actor?:string;role?:string;tags?:string[]}={}){
    return this.assets({...query,status:'approved'});
  }

  async candidateAssets(query:{kind?:MonIAAssetKind;actor?:string;role?:string;tags?:string[]}={}){
    return this.assets({...query,status:'candidate'});
  }

  async bestReusableAsset(query:{kind:MonIAAssetKind;actor?:string;role?:string;tags?:string[]}){
    const exact=await this.approvedAssets(query);if(exact.length)return exact[0];
    const relaxed=await this.approvedAssets({kind:query.kind,actor:query.actor,role:query.role});
    return relaxed[0]||null;
  }

  async markUsed(id:string){
    const assets=await this.all<MonIAAsset>('assets');const asset=assets.find(x=>x.id===id);if(!asset)return;
    asset.useCount=(asset.useCount||0)+1;asset.updatedAt=Date.now();await this.put('assets',asset);
  }

  async recordGeneration(record:Omit<MonIAGenerationRecord,'id'|'createdAt'>){
    const value:MonIAGenerationRecord={...record,id:`gen-${Date.now()}-${Math.random().toString(36).slice(2)}`,createdAt:Date.now()};
    await this.put('generations',value);return value;
  }

  async recentGenerations(limit=30){return (await this.all<MonIAGenerationRecord>('generations')).sort((a,b)=>b.createdAt-a.createdAt).slice(0,Math.max(1,limit))}

  async stats(){
    const assets=await this.all<MonIAAsset>('assets'),canon=await this.all<MonIACanonRecord>('canon'),generations=await this.all<MonIAGenerationRecord>('generations');
    return {assets:assets.length,approved:assets.filter(x=>x.status==='approved').length,candidates:assets.filter(x=>x.status==='candidate').length,canon:canon.length,lockedCanon:canon.filter(x=>x.locked).length,generations:generations.length,reused:generations.filter(x=>x.status==='reused').length};
  }
}

export const moniaCreativeVault=new CreativeVault();
