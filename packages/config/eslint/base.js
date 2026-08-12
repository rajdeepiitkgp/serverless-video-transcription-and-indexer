import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

/**
 * Base ESLint flat config for all TypeScript packages in the monorepo.
 *
 * Consumers add their own `eslint.config.js`:
 *
 *   import base from '@vidx/config/eslint/base';
 *   export default [...base];
 *
 * Type-aware rules resolve each package's tsconfig via the project service,
 * so packages need no per-package parser wiring.
 */
export default defineConfig(
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Use named exports (docs/style-guide.md). Framework files may override locally.',
        },
      ],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
    },
  },
  {
    ignores: ['**/dist/**', '**/out/**', '**/coverage/**'],
  },
);
