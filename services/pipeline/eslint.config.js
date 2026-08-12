import base from '@vidx/config/eslint/base';

export default [
  ...base,
  {
    // The replay CLI is a local debugging tool (plan §7); console *is* its output.
    files: ['src/replay/cli.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
