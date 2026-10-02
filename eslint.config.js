import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/*.config.js', 'packages/app/dist/**'] },
  { files: ['**/public/**/*.js'], languageOptions: { globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', clients: 'readonly', skipWaiting: 'readonly' } } },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off'
    }
  }
);
