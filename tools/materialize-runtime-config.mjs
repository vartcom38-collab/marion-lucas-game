import { copyFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const files = [
  ['config/monia-visio-approved.json', 'public/config/monia-visio-approved.json'],
];

for (const [source, target] of files) {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`[runtime-config] ${source} -> ${target}`);
}
