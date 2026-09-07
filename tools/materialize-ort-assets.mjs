import { access, cp, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const source=resolve('node_modules/onnxruntime-web/dist');
const target=resolve('public/ort');
const ORT_VERSION='1.18.0';

await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});

const files=await readdir(source);
const selected=files.filter(name=>/^ort-(?:training-)?wasm.*\.(?:js|mjs|wasm)$/.test(name));
if(!selected.length)throw new Error('No ONNX Runtime WASM assets found in npm package');

for(const name of selected){
  await cp(resolve(source,name),resolve(target,name));
}

async function exists(path){
  try{await access(path);return true}catch{return false}
}

// ORT 1.18 predates the newer 1.19+ ESM runtime layout. Piper's pinned
// runtime must therefore use exactly the assets shipped by the installed
// 1.18 npm package instead of trying to fetch a 1.19-style .mjs file from a CDN.
const required=['ort-wasm-simd.wasm','ort-wasm-simd-threaded.wasm'];
for(const name of required){
  if(!await exists(resolve(target,name)))throw new Error(`Required pinned ORT ${ORT_VERSION} asset missing from npm package: ${name}`);
}

console.log(`[MonIA] Same-origin ONNX Runtime ${ORT_VERSION} ready in public/ort (${selected.length} pinned npm assets; no runtime CDN fetch)`);
