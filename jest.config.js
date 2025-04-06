module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
  },
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 10000,
  maxWorkers: 1,
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native)/)'
  ]
};
// jest.config.js
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
    '^react-native-ble-manager$': '<rootDir>/__mocks__/react-native-ble-manager.ts',
  },
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 10000,
  maxWorkers: 1
};