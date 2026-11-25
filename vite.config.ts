import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  // Every asset URL is relative and routing lives in the hash, so the build runs
  // from any static path: a GitHub Pages project site under /KnowledgeWeb/, a
  // subdirectory of another host, or a plain file server. No rebuild per host.
  base: './',
  plugins: [react()],
  // One source of truth for the version the interface reports.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { sourcemap: false },
  // The audit harness keeps browser profiles and logs in .tooling/; watching them
  // made the dev server reload whenever a probe browser touched its profile.
  server: { watch: { ignored: ['**/.tooling/**'] } },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
