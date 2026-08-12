import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Component tests only (Vitest + RTL, docs/testing-principles.md). The 80% coverage
// gate applies to services/* and packages/shared, not apps/web (plan §10).
// eslint-disable-next-line no-restricted-syntax -- Vitest requires a default export
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/support/setup.ts'],
  },
});
