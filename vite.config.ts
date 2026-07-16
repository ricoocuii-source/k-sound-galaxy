import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {copyFileSync, mkdirSync, readFileSync} from 'node:fs';
import path from 'path';
import {defineConfig} from 'vite';

const copyRuntimeAssets = {
  name: 'copy-runtime-assets',
  apply: 'build' as const,
  closeBundle() {
    const modelPath = path.resolve(__dirname, 'models/starfighter/scene.gltf');
    const model = JSON.parse(readFileSync(modelPath, 'utf8')) as {
      buffers?: Array<{uri?: string}>;
      images?: Array<{uri?: string}>;
    };
    const modelFiles = [
      'models/starfighter/scene.gltf',
      'models/starfighter/license.txt',
      ...(model.buffers || []).flatMap(({uri}) => uri ? [`models/starfighter/${uri}`] : []),
      ...(model.images || []).flatMap(({uri}) => uri ? [`models/starfighter/${uri}`] : []),
    ];
    const files = [
      'vendor/augmented-ui.min.css',
      'textures/milky-way-640.webp',
      ...modelFiles,
    ];
    for (const file of files) {
      const target = path.resolve(__dirname, 'dist', 'client', file);
      mkdirSync(path.dirname(target), {recursive: true});
      copyFileSync(path.resolve(__dirname, file), target);
    }
  },
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), copyRuntimeAssets],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist/client',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          proto7: path.resolve(__dirname, 'proto7.html'),
        },
      },
    },
    server: {
      // Toggle HMR / file-watching via the DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
