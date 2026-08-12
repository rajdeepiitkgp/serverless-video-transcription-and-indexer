import { defineConfig } from 'vitest/config';

// Coverage gates per docs/testing-principles.md: 80% lines/branches on the package,
// ~100% on the VI parsers (they encode the VI JSON contract).
// eslint-disable-next-line no-restricted-syntax -- Vitest requires a default export
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
        'src/vi/**/*.ts': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});
