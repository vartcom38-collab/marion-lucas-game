import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';

const root=process.cwd();
const outDir=resolve(root,'public/resources/living');
mkdirSync(outDir,{recursive:true});

function ffmpeg(args){
  const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error(`ffmpeg failed with code ${r.status}`);
}

function stillLoop(source,out,{duration=12,zoom=1.045,x='iw/2-(iw/zoom/2)',y='ih/2-(ih/zoom/2)',warm=false}={}){
  if(!existsSync(source)){console.log(`[living] missing source, skipping ${source}`);return false}
  const filters=[
    `scale=1920:1080:force_original_aspect_ratio=increase`,
    `crop=1920:1080`,
    `zoompan=z='min(zoom+0.00018,${zoom})':x='${x}':y='${y}':d=${duration*30}:s=1920x1080:fps=30`,
    warm?`eq=brightness=0.015:saturation=1.045:contrast=1.015`:`eq=saturation=1.02:contrast=1.01`,
    `format=yuv420p`
  ].join(',');
  ffmpeg(['-loop','1','-i',source,'-t',String(duration),'-vf',filters,'-an','-c:v','libx264','-preset','veryfast','-crf','25','-movflags','+faststart',out]);
  console.log(`[living] generated ${out}`);
  return true;
}

function deriveNimesSource(){
  const mainPath=resolve(root,'src/main.ts');
  if(!existsSync(mainPath))return null;
  const src=readFileSync(mainPath,'utf8');
  const patterns=[
    /nimes\s*:\s*\{[^}]*?visual\s*:\s*'([^']+)'/s,
    /nimes\s*:\s*\{[^}]*?visual\s*:\s*"([^"]+)"/s,
  ];
  for(const re of patterns){
    const m=src.match(re);
    if(!m)continue;
    const value=m[1].replace(/^\.\//,'');
    const candidates=[resolve(root,'public',value),resolve(root,'public/resources',value.split('/').pop()||''),resolve(root,value)];
    for(const c of candidates)if(existsSync(c))return c;
  }
  const fallbacks=[
    resolve(root,'public/resources/photo.png'),
    resolve(root,'public/resources/photo-adoree.webp'),
  ];
  return fallbacks.find(existsSync)||null;
}

stillLoop(resolve(root,'public/resources/appartement-nimes.png'),resolve(outDir,'home.mp4'),{
  duration:14,zoom:1.038,x:'iw/2-(iw/zoom/2)+18*sin(on/85)',y:'ih/2-(ih/zoom/2)-8*sin(on/120)',warm:true
});

const nimes=deriveNimesSource();
if(nimes){
  stillLoop(nimes,resolve(outDir,'nimes.mp4'),{
    duration:13,zoom:1.05,x:'iw/2-(iw/zoom/2)-22*sin(on/95)',y:'ih/2-(ih/zoom/2)+6*sin(on/110)',warm:true
  });
}else{
  console.log('[living] no safe local Nîmes still found; leaving photo fallback active');
}
