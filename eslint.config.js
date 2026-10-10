import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'tests/fixtures/.built-editors/**',
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Config files and build scripts sit outside tsconfig's `include`,
          // so the project service has to be told it may still parse them.
          allowDefaultProject: ['*.js', 'scripts/*.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // User text must never end up in logs. Banning console.log makes any
      // logging a deliberate, reviewable choice.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      eqeqeq: ['error', 'always'],
      // innerHTML and friends turn text into markup. All user text is
      // rendered through React, which escapes it.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Render text through React or textContent.' },
        { property: 'outerHTML', message: 'Render text through React or textContent.' },
        { property: 'insertAdjacentHTML', message: 'Render text through React or textContent.' },
      ],
    },
  },
  {
    files: ['src/**/*.tsx', 'tests/**/*.tsx'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      // Playwright fixtures declare dependencies through an empty destructuring
      // pattern, which this rule would otherwise flag.
      'no-empty-pattern': 'off',
    },
  },
  {
    files: ['*.config.ts', '*.config.js', 'scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
    rules: {
      // Build scripts report their results to the person running them.
      'no-console': 'off',
    },
  },
  prettier
);
