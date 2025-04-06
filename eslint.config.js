const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const path = require('path');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const customGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  module: 'readonly',
  require: 'readonly',
  __DEV__: 'readonly',
  process: 'readonly',
  global: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setImmediate: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  NodeJS: 'readonly',
};

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: [
      '**/node_modules/**',
      'lib/**',
      'dist/**',
      'coverage/**',
      'example/**',
      '__mocks__/**',
      '__tests__/**',
      '.github/**',
      '.husky/**',
      '.yarn/**',
      'docs/**',
      'lib/**',
      'test/**',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: customGlobals,
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    }
  },
  ...compat.config({
    extends: [
      '@react-native-community',
      'eslint:recommended',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended',
    ],
  }),
];
