module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  testTimeout: 30000,
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|react-native-ble-manager|react-native-permissions)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: [
    './jest.setup.js',
    '@testing-library/jest-native/extend-expect',
    '<rootDir>/jest.setup.js',
  ],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/__tests__/**',
    '!src/examples/**',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    },
  },
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__tests__/mocks/react-native.js',
    '^react-native/Libraries/ActionSheetIOS/ActionSheetIOS$': '<rootDir>/__mocks__/actionSheetMock.js'
  }
};
