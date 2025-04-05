module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['./jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  silent: false,
  testTimeout: 30000, // Increased timeout for async tests
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|react-native-ble-manager)/)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__mocks__/'
  ],
  collectCoverage: true,
  bail: false // Don't stop on first test failure
};
