import { access, cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source=resolve('node_modules/onnxruntime-web/dist');
const target=resolve('public/ort');
const ORT_VERSION='1.18.0';
const EXACT_RUNTIME=['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'];
const STATIC_SOURCE=`https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/${ORT_VERSION}/`;

await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});

const files=await readdir(source);
const selected=files.filter(name=>/^ort-wasm.*\.(?:mjs|wasm)$/.test(name));
if(!selected.length)throw new Error('No ONNX Runtime WASM assets found in npm package');

for(const name of selected){
  await cp(resolve(source,name),resolve(target,name));
}

async function exists(path){
  try{await access(path);return true}catch{return false}
}

for(const name of EXACT_RUNTIME){
  const destination=resolve(target,name);
  if(await exists(destination))continue;
  const response=await fetch(`${STATIC_SOURCE}${name}`);
  if(!response.ok)throw new Error(`Unable to materialize ${name} · HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<1024)throw new Error(`Downloaded ${name} is unexpectedly small (${bytes.length} bytes)`);
  await writeFile(destination,bytes);
  console.log(`[MonIA] Materialized missing ${name} from pinned ONNX Runtime ${ORT_VERSION} build`);
}

for(const name of EXACT_RUNTIME){
  if(!await exists(resolve(target,name)))throw new Error(`Required same-origin ORT asset missing: ${name}`);
}

console.log(`[MonIA] Same-origin ONNX Runtime ${ORT_VERSION} ready in public/ort (${selected.length} npm assets + exact Piper runtime)`);
