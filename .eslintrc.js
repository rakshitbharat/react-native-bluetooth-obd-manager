// .eslintrc.js
module.exports = {
  root: true,
  extends: [
    '@react-native-community', // Base React Native rules
    'eslint:recommended',
    'plugin:react/recommended', // React specific linting rules
    'plugin:react-hooks/recommended', // Enforce Rules of Hooks
    'plugin:@typescript-eslint/recommended', // TypeScript specific linting rules
    'plugin:@typescript-eslint/recommended-requiring-type-checking', // Additional rules requiring type info
    'plugin:prettier/recommended', // Integrates Prettier with ESLint
  ],
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser for TypeScript
  parserOptions: {
    ecmaFeatures: {
      jsx: true, // Allows for the parsing of JSX
    },
    ecmaVersion: 2021, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
    project: './tsconfig.eslint.json', // Change this to use the new eslint-specific config
  },
  plugins: [
    'react',
    'react-hooks',
    '@typescript-eslint',
    'prettier', // Runs Prettier as an ESLint rule
  ],
  settings: {
    react: {
      version: 'detect', // Tells eslint-plugin-react to automatically detect the version of React to use
    },
  },
  rules: {
    // Common Overrides
    'prettier/prettier': ['error', {}, { usePrettierrc: true }], // Use .prettierrc rules
    'react/react-in-jsx-scope': 'off', // Not needed with newer React versions
    'react/prop-types': 'off', // We use TypeScript for type checking props

    // TypeScript Specific Rules
    '@typescript-eslint/explicit-function-return-type': 'warn', // Prefer explicit return types but allow inference sometimes (warn instead of error)
    '@typescript-eslint/no-explicit-any': 'warn', // Warn against using `any` type
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Warn about unused vars, allowing underscore prefix
    '@typescript-eslint/no-floating-promises': 'error', // Require handling of Promise results
    '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false, // Allow async functions passed to void contexts (like useEffect cleanup)
        },
    ],
    '@typescript-eslint/interface-name-prefix': 'off', // Allow interface names without "I" prefix
    '@typescript-eslint/no-inferrable-types': 'warn', // Warn if types can be easily inferred
    '@typescript-eslint/no-shadow': ['error'], // Disallow variable declarations from shadowing variables declared in the outer scope


    // React Specific Rules
    'react-hooks/rules-of-hooks': 'error', // Checks rules of Hooks
    'react-hooks/exhaustive-deps': 'warn', // Checks effect dependencies, warn only as it can be sometimes overly strict

    // General Rules
    'no-shadow': 'off', // Disabled in favour of @typescript-eslint/no-shadow
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }], // Allow console.warn/error/info
    'no-empty-function': 'off', // Allow empty functions (useful for placeholders)
    '@typescript-eslint/no-empty-function': 'warn', // Prefer explicit indication if empty function is intended
    'no-duplicate-imports': 'error',
    'sort-imports': [ // Optional: Enforce sorted imports
      'warn',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true, // Let Prettier handle declaration sort
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: true,
      },
    ],
    // Add any other specific rules you want to enforce
  },
  ignorePatterns: [
    'node_modules/',
    'lib/', // Ignore built output if exists
    'dist/', // Ignore build output
    'example/', // Ignore example app
    'coverage/', // Ignore coverage reports
    'babel.config.js',
    'metro.config.js',
    'jest.config.js',
    '*.config.js', // Ignore other config files at root
  ],
};