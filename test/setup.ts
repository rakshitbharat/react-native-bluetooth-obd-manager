import '@testing-library/jest-native/extend-expect';

global.__DEV__ = true;

// Basic React Native mock
jest.mock('react-native', () => ({
  NativeModules: {},
  NativeEventEmitter: function() {
    return {
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeListener: jest.fn(),
    };
  },
  Platform: {
    OS: 'android',
    Version: 31,
    select: jest.fn(obj => obj.android)
  },
}));

// Set up timers before each test
beforeEach(() => {
  jest.useFakeTimers();
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Mock Date.now
jest.spyOn(Date, 'now').mockImplementation(() => 1678886400000);
