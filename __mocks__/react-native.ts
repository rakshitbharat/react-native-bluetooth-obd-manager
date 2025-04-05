const React = require('react');

const mockComponent = (name: string) => {
  const ComponentMock = (props: any) => React.createElement(name, props);
  ComponentMock.displayName = name;
  return ComponentMock;
};

const bleManagerModule = {
  start: jest.fn(() => Promise.resolve()),
  scan: jest.fn(() => Promise.resolve()),
  stopScan: jest.fn(() => Promise.resolve()),
  connect: jest.fn(() => Promise.resolve()),
  disconnect: jest.fn(() => Promise.resolve()),
  checkState: jest.fn(() => Promise.resolve()),
  enableBluetooth: jest.fn(() => Promise.resolve()),
  write: jest.fn(() => Promise.resolve()),
  writeWithoutResponse: jest.fn(() => Promise.resolve()),
  read: jest.fn(() => Promise.resolve()),
  retrieveServices: jest.fn(() => Promise.resolve()),
  startNotification: jest.fn(() => Promise.resolve()),
  stopNotification: jest.fn(() => Promise.resolve()),
};

export default {
  NativeModules: {
    BleManager: bleManagerModule,
  },
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  })),
  Platform: {
    OS: 'android',
    select: jest.fn(obj => obj.android),
  },
  ActivityIndicator: mockComponent('ActivityIndicator'),
  View: mockComponent('View'),
  Text: mockComponent('Text'),
};
