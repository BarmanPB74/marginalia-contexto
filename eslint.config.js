import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'android/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // Regla 6 de CLAUDE.md: nunca HTML crudo sin sanitizar.
      'no-restricted-properties': ['error', { property: 'innerHTML', message: 'Usa DOMPurify o JSX.' }],
    },
  },
  // Scripts de mantenimiento: corren en Node, no en la app
  { files: ['scripts/**'], languageOptions: { globals: { ...globals.node } } },
);
