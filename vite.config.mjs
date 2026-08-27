import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const processEnvValues = {
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    global: 'globalThis',
  };

  Object.keys(env).forEach((key) => {
    if (key.startsWith('REACT_APP_') || key.startsWith('VITE_')) {
      processEnvValues[`process.env.${key}`] = JSON.stringify(env[key]);
    }
  });

  return {
    plugins: [
      react(),
    ],
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },
    envPrefix: ['VITE_', 'REACT_APP_'],
    define: processEnvValues,
    server: {
      port: 3000,
      open: false,
    },
    build: {
      outDir: 'build',
      sourcemap: true,
    },
  };
});
