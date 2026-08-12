import { defineConfig } from 'vitest/config';

// Coverage gates per docs/testing-principles.md: 80% lines/branches on the package,
// ~100% on core/ (pure domain, TDD). Excluded from coverage (not from review):
// - src/functions/**: trigger registrations that run at Functions-host import time.
// - src/app/composition-root.ts: constructs real Azure SDK clients from managed
//   identity; exercised by deploy + the M7 smoke test, not unit-testable offline.
// - src/replay/cli.ts: argv/stdout shell over the fully tested replay module.
// eslint-disable-next-line no-restricted-syntax -- Vitest requires a default export
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/support/azurite-global-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/functions/**',
        'src/app/composition-root.ts',
        'src/replay/cli.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
        'src/core/**/*.ts': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});
