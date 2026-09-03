import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = process.cwd();
const items = [
  { name:'lucas', chunks:2, target:'public/resources/monia/atlas-lucas.webp', bytes:25086, sha256:'41d6c9a28bc7869276e107085a14ee9f3d197f80658f61c4b346f82ad73ada8c' },
  { name:'marion', chunks:5, target:'public/resources/monia/atlas-marion.webp', bytes:59932, sha256:'6703f9070671b3fc92b99480115dc8edbe0b161ed730126eedc26c6b6df717b8' },
  { name:'duo-i', chunks:5, target:'public/resources/monia/atlas-duo-i.webp', bytes:56634, sha256:'ef3287516cf8db2c0fca27b2f2106eb28a2b99f419bbdff3a4735c710485ae60' },
  { name:'duo-ii', chunks:4, target:'public/resources/monia/atlas-duo-ii.webp', bytes:51734, sha256:'68e71cea7ff86ef84942c87398450f1c1ae7562609c19218e8f9632d83a14451' },
];

await mkdir(resolve(root, 'public/resources/monia'), { recursive:true });

for (const item of items) {
  const files = Array.from({ length:item.chunks }, (_, i) =>
    resolve(root, `assets/monia-atlas/chunks/${item.name}-${String(i).padStart(2,'0')}.b64`)
  );
  const availability = await Promise.all(files.map(async file => {
    try { await access(file); return true; } catch { return false; }
  }));
  if (!availability.every(Boolean)) {
    console.warn(`[MonIA] atlas ${item.name} incomplet: activation reportée (${availability.filter(Boolean).length}/${item.chunks})`);
    continue;
  }

  let encoded = '';
  for (const file of files) encoded += (await readFile(file, 'utf8')).replace(/\s+/g, '');
  const data = Buffer.from(encoded, 'base64');
  const signature = data.subarray(0, 4).toString('ascii');
  const format = data.subarray(8, 12).toString('ascii');
  const sha256 = createHash('sha256').update(data).digest('hex');
  if (signature !== 'RIFF' || format !== 'WEBP') throw new Error(`[MonIA] ${item.name}: invalid WebP signature`);
  if (data.length !== item.bytes) throw new Error(`[MonIA] ${item.name}: expected ${item.bytes} bytes, got ${data.length}`);
  if (sha256 !== item.sha256) throw new Error(`[MonIA] ${item.name}: checksum mismatch`);
  await writeFile(resolve(root, item.target), data);
  console.log(`[MonIA] canonical atlas verified: ${item.target}`);
}
