import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const CDN='https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/';

export default defineConfig({
  base: './',
  optimizeDeps:{
    exclude:['@mintplex-labs/piper-tts-web'],
  },
  plugins:[{
    name:'monia-local-piper-ort',
    enforce:'pre',
    transform(code,id){
      if(!id.includes('@mintplex-labs/piper-tts-web'))return null;
      if(!code.includes(CDN))return null;
      return {code:code.split(CDN).join('/ort/'),map:null};
    },
  }],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        moniaTest: resolve(__dirname, 'monia-test.html'),
        moniaKaggleTest: resolve(__dirname, 'monia-kaggle-test.html'),
        dramaReview: resolve(__dirname, 'drama-review.html'),
        latestVisio: resolve(__dirname, 'latest-visio.html'),
      },
      maxParallelFileOps: 128,
    },
  },
});
