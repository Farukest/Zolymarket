import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  assetsInclude: ['**/*.wasm'],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@services': resolve(__dirname, 'src/services'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },

  server: {
    port: 5173,
    host: '127.0.0.1',
    open: false, // Disable auto-opening browser (for server environments)
    cors: true,
    fs: {
      // Allow serving files from parent directories (for workspace monorepo)
      allow: ['..']
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['framer-motion', 'lucide-react'],
          web3: ['ethers', 'fhevmjs'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'ethers',
      'axios',
      'framer-motion',
      'lucide-react',
      'react-hot-toast',
      'date-fns',
      // FHEVM dependencies
      'keccak',
      'bigint-buffer',
      'commander',
      'fetch-mock',
      'wasm-feature-detect',
    ],
    exclude: ['fhevmjs', 'node-tfhe', 'node-tkms', 'tfhe', 'tkms'],
    esbuildOptions: {
      loader: {
          '.js': 'jsx'
      }
    }
  },

  worker: {
    format: 'es',
    plugins: () => []
  },

  define: {
    global: 'globalThis',
    'process.env': 'import.meta.env',
  },

  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },

  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    loader: 'jsx',
    include: /src\/.*\.[jt]sx?$/,
    exclude: []
  },
});