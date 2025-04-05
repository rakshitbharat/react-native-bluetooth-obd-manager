const React = require('react');

// Mock component helper
const mockComponent = (name: string) => {
  const ComponentMock = (props: any) => React.createElement(name, props);
  ComponentMock.displayName = name;
  return ComponentMock;
};

// Create event emitter mock here instead of importing
const mockNativeEventEmitter = {
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeAllListeners: jest.fn(),
  emit: jest.fn(),
};

// Create mock BleManager module
const mockBleManager = {
  start: jest.fn(() => Promise.resolve()),
  scan: jest.fn(() => Promise.resolve()),
  stopScan: jest.fn(() => Promise.resolve()),
  connect: jest.fn(() => Promise.resolve()),
  disconnect: jest.fn(() => Promise.resolve()),
  checkState: jest.fn(),
  enableBluetooth: jest.fn(() => Promise.resolve()),
  write: jest.fn(() => Promise.resolve()),
  writeWithoutResponse: jest.fn(() => Promise.resolve()),
  retrieveServices: jest.fn(() => Promise.resolve()),
  startNotification: jest.fn(() => Promise.resolve()),
  stopNotification: jest.fn(() => Promise.resolve()),
};

const mockPermissions = {
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
  checkMultiple: jest.fn(),
  requestMultiple: jest.fn(),
};

const ReactNativeMock = {
  NativeModules: {
    BleManager: mockBleManager,
    RNCPermissions: mockPermissions,
  },
  NativeEventEmitter: jest.fn(() => mockNativeEventEmitter),
  Platform: {
    OS: 'android',
    Version: 31,
    select: jest.fn(obj => obj.android),
  },
  // Add basic UI component mocks
  View: mockComponent('View'),
  Text: mockComponent('Text'),
  ActivityIndicator: mockComponent('ActivityIndicator'),
};

module.exports = ReactNativeMock;
export { mockNativeEventEmitter, mockBleManager, mockPermissions };

// Add a basic test to satisfy Jest's requirement
describe('react-native mocks', () => {
  it('provides mock implementations', () => {
    expect(mockNativeEventEmitter).toBeDefined();
    expect(mockBleManager).toBeDefined();
  });
});
