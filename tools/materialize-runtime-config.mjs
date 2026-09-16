import { copyFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const files = [
  ['config/monia-visio-approved.json', 'public/config/monia-visio-approved.json'],
  ['config/drama-approved.json', 'public/config/drama-approved.json'],
  ['config/motion-reference-bank.json', 'public/config/motion-reference-bank.json'],
  ['config/lucas-reference-bank.json', 'public/config/lucas-reference-bank.json'],
  ['config/monia-scene-router.json', 'public/config/monia-scene-router.json'],
];

for (const [source, target] of files) {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`[runtime-config] ${source} -> ${target}`);
}
