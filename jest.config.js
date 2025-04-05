// jest.config.js
module.exports = {
  preset: 'react-native', // Use the standard preset for React Native
  testEnvironment: 'node', // Usually correct for testing library logic without native UI
  moduleFileExtensions: [
      "ts",
      "tsx",
      "js",
      "jsx",
      "json",
      "node"
  ],
  modulePathIgnorePatterns: [
      "<rootDir>/example/node_modules", // Ignore example app modules
      "<rootDir>/lib/" // Ignore built output
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  // Ensure setup file runs AFTER environment is set up
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect', // Provides extra RN matchers
    '<rootDir>/jest.setup.js', // Your custom setup file for mocks
  ],
  collectCoverageFrom: [
      "src/**/*.{ts,tsx}", // Collect coverage from source files
      "!src/types/**/*", // Exclude type definitions
      "!src/index.ts" // Exclude main index export
  ],
  coverageReporters: [
      "json-summary",
      "text",
      "lcov"
  ],
};