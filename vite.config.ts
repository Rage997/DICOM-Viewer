import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import wasm from 'vite-plugin-wasm';
import path from 'path';
import { readFileSync } from 'fs';

// App version, injected at build time from package.json (single source of truth).
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    wasm(), // For dcmjs WASM support
  ],
  server: {
    host: true, // Listen on all interfaces (IPv4 + IPv6) so Tailscale Funnel can reach it
    port: 8050,
    strictPort: false, // If 8050 is taken, try 8051, 8052, etc.
    allowedHosts: ['rages-macbook-air.tail71b6ae.ts.net'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['dcmjs'], // dcmjs has WASM, exclude from pre-bundling
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'dcmjs': ['dcmjs'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
