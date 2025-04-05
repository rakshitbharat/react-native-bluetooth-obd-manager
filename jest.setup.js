import { jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Silence React Native warnings in tests
jest.mock('react-native/Libraries/LogBox/LogBox', () => ({
  ignoreLogs: jest.fn(),
}));

// Mock react-native
jest.mock('react-native', () => require('../__mocks__/react-native'));

// Mock react-native-ble-manager
jest.mock('react-native-ble-manager', () => ({
  start: jest.fn(() => Promise.resolve()),
  checkState: jest.fn(() => Promise.resolve('on')),
  scan: jest.fn(() => Promise.resolve()),
  stopScan: jest.fn(() => Promise.resolve()),
  connect: jest.fn(() => Promise.resolve()),
  disconnect: jest.fn(() => Promise.resolve()),
  retrieveServices: jest.fn(() => Promise.resolve({
    id: 'test-device',
    services: [{ uuid: 'FFE0' }],
    characteristics: [
      {
        service: 'FFE0',
        characteristic: 'FFE1',
        properties: {
          Write: 'Write',
          Notify: 'Notify',
        },
      },
    ],
  })),
  write: jest.fn(() => Promise.resolve()),
  writeWithoutResponse: jest.fn(() => Promise.resolve()),
  startNotification: jest.fn(() => Promise.resolve()),
  stopNotification: jest.fn(() => Promise.resolve()),
  isPeripheralConnected: jest.fn(() => Promise.resolve(false)),
  readRSSI: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    IOS: {
      BLUETOOTH_PERIPHERAL: 'ios.permission.BLUETOOTH_PERIPHERAL',
    }
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
  check: jest.fn(() => Promise.resolve('granted')),
  request: jest.fn(() => Promise.resolve('granted')),
  checkMultiple: jest.fn(() => Promise.resolve({})),
  requestMultiple: jest.fn(() => Promise.resolve({})),
}));

// Mock NativeEventEmitter
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  const { MockNativeEventEmitter } = require('./__mocks__/react-native-ble-manager');
  return MockNativeEventEmitter;
});

// Increase test timeout
jest.setTimeout(30000);

// Global Test Setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});