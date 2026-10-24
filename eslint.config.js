import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import boundaries from 'eslint-plugin-boundaries'
import svelte from 'eslint-plugin-svelte'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
  {
    files: ['**/*.ts', '**/*.svelte', '**/*.svelte.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      svelte.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-expect-error': 'allow-with-description',
          'ts-nocheck': true,
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] },
    },
  },

  // Layers: ui -> app -> core, never the other way round.
  {
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core', partialMatch: false },
        { type: 'app', pattern: 'src/app', partialMatch: false },
        { type: 'ui', pattern: 'src/ui', partialMatch: false },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { from: { element: { type: 'core' } }, allow: { to: { element: { type: 'core' } } } },
            {
              from: { element: { type: 'app' } },
              allow: { to: { element: { types: { anyOf: ['app', 'core'] } } } },
            },
            {
              from: { element: { type: 'ui' } },
              allow: { to: { element: { types: { anyOf: ['ui', 'app', 'core'] } } } },
            },
            { allow: { to: { module: { origin: 'external' } } } },
          ],
        },
      ],
    },
  },

  // core is pure TypeScript: no UI or storage packages, no DOM, no Date.
  {
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts', 'src/core/test-utils/**'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(svelte|react|react-dom|dexie|zustand|immer|@tiptap)(/.*)?$',
              message: 'src/core hanya boleh TypeScript murni (lihat docs/decisions/002).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB'].map(
          (name) => ({ name, message: 'src/core tidak boleh memakai API DOM.' }),
        ),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: "Pakai string 'YYYY-MM-DD' dan core/dates.ts, bukan objek Date.",
        },
        {
          selector: "CallExpression[callee.name='Date']",
          message: "Pakai string 'YYYY-MM-DD' dan core/dates.ts, bukan objek Date.",
        },
        {
          selector: "MemberExpression[object.name='Date']",
          message: "Pakai string 'YYYY-MM-DD' dan core/dates.ts, bukan objek Date.",
        },
        {
          selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']",
          message: 'Format tanggal untuk tampilan dilakukan di src/ui, bukan di core.',
        },
      ],
    },
  },

  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  prettier,
  ...svelte.configs.prettier,
])
