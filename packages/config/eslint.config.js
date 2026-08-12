import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';

// This package contains only plain-JS config files; consumers of the shared
// TypeScript preset live in the other workspace packages.
export default defineConfig({
  files: ['**/*.js'],
  extends: [eslint.configs.recommended],
});
