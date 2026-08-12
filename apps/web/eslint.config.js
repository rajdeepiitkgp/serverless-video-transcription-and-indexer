import base from '@vidx/config/eslint/base';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...base,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Next.js App Router entry files must default-export (docs/style-guide.md carve-out).
    files: [
      'src/app/**/page.tsx',
      'src/app/**/layout.tsx',
      'src/app/**/not-found.tsx',
      'src/app/**/error.tsx',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    ignores: ['.next/**', 'out/**', 'next-env.d.ts'],
  },
];
