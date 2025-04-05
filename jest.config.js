// jest.config.js
module.exports = {
  preset: 'react-native',
  testEnvironment: 'jsdom',
  setupFiles: [
    '<rootDir>/node_modules/react-native/jest/setup.js',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts',
  ],
  moduleFileExtensions: [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node"
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: ['module:metro-react-native-babel-preset'],
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-ble-manager|react-native-permissions)/)',
  ],
  testPathIgnorePatterns: [
    '\\.snap$',
    '<rootDir>/node_modules/',
  ],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.ts'
  },
  globals: {
    '__DEV__': true
  },
  testTimeout: 10000,
  fakeTimers: {
    enableGlobally: true,
    now: 1678886400000, // Set consistent timestamp
    doNotFake: ['nextTick', 'setImmediate']
  },
  testEnvironmentOptions: {
    url: 'http://localhost',
    customExportConditions: ['node', 'node-addons']
  }
};