import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = process.cwd();
const items = [
  { source:'assets/monia-atlas/lucas.webp.b64', target:'public/resources/monia/atlas-lucas.webp', bytes:84440, sha256:'dccac1a652222e10d0f41218dc82bb1a918dfb540a6f64d6c18bfb11485ef626' },
  { source:'assets/monia-atlas/marion.webp.b64', target:'public/resources/monia/atlas-marion.webp', bytes:141196, sha256:'d7c3b513f98e651738a2d9531d7362f7a14669fcaeb4a16d1459c68c3db830d0' },
  { source:'assets/monia-atlas/duo-i.webp.b64', target:'public/resources/monia/atlas-duo-i.webp', bytes:132212, sha256:'0dc0c5c8858551448b9e63c3d2dd725124f5298918623ee79e1bf6b6aa398d24' },
  { source:'assets/monia-atlas/duo-ii.webp.b64', target:'public/resources/monia/atlas-duo-ii.webp', bytes:129882, sha256:'36d055e4ee512007c2ebf79d258870b6bc5d722c597177367faf0da8ed8a03ef' },
];

await mkdir(resolve(root, 'public/resources/monia'), { recursive:true });

for (const item of items) {
  const encoded = (await readFile(resolve(root, item.source), 'utf8')).replace(/\s+/g, '');
  const data = Buffer.from(encoded, 'base64');
  const signature = data.subarray(0, 4).toString('ascii');
  const format = data.subarray(8, 12).toString('ascii');
  const sha256 = createHash('sha256').update(data).digest('hex');
  if (signature !== 'RIFF' || format !== 'WEBP') throw new Error(`[MonIA] ${item.source}: invalid WebP signature`);
  if (data.length !== item.bytes) throw new Error(`[MonIA] ${item.source}: expected ${item.bytes} bytes, got ${data.length}`);
  if (sha256 !== item.sha256) throw new Error(`[MonIA] ${item.source}: checksum mismatch`);
  await writeFile(resolve(root, item.target), data);
  console.log(`[MonIA] canonical atlas verified: ${item.target}`);
}
