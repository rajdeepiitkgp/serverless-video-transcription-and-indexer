import shared from '@vidx/config/prettier';
// Imported (not named as a string) so the plugin resolves from this package even when
// Prettier runs from the repo root.
import * as tailwindcss from 'prettier-plugin-tailwindcss';

// Extends the shared config with Tailwind class sorting (docs/style-guide.md).

export default {
  ...shared,
  plugins: [tailwindcss],
  tailwindStylesheet: './src/app/globals.css',
};
