module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
    'react-native-beautiful-logs': '<rootDir>/__mocks__/react-native-beautiful-logs.ts',
  },
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 10000,
  maxWorkers: 1,
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-beautiful-logs)/)'
  ],
  testPathIgnorePatterns: ['<rootDir>/lib/'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {configFile: './babel.config.cjs'}],
  }
};
