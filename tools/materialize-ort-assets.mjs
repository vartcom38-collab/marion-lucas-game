import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const source=resolve('node_modules/onnxruntime-web/dist');
const target=resolve('public/ort');

await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});

const files=await readdir(source);
const selected=files.filter(name=>/^ort-wasm.*\.(?:mjs|wasm)$/.test(name));
if(!selected.length)throw new Error('No ONNX Runtime WASM assets found');

for(const name of selected){
  await cp(resolve(source,name),resolve(target,name));
}

console.log(`[MonIA] Materialized ${selected.length} same-origin ONNX Runtime assets in public/ort`);
