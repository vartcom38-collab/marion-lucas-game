import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        moniaTest: resolve(__dirname, 'monia-test.html'),
      },
      maxParallelFileOps: 128,
    },
  },
});
