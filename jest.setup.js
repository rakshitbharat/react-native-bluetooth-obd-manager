// Silence React Native warnings in tests
jest.mock('react-native/Libraries/LogBox/LogBox', () => ({
  ignoreLogs: jest.fn(),
}));

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
}));

// Mock react-native-permissions with the correct functions
jest.mock('react-native-permissions', () => {
  return {
    check: jest.fn(() => Promise.resolve('granted')),
    request: jest.fn(() => Promise.resolve('granted')),
    checkMultiple: jest.fn((permissions) => {
      const result = {};
      Object.keys(permissions).forEach(permission => {
        result[permission] = 'granted';
      });
      return Promise.resolve(result);
    }),
    requestMultiple: jest.fn((permissions) => {
      const result = {};
      Object.keys(permissions).forEach(permission => {
        result[permission] = 'granted';
      });
      return Promise.resolve(result);
    }),
    PERMISSIONS: {
      ANDROID: {
        BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
        BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
        ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      },
      IOS: {
        BLUETOOTH_PERIPHERAL: 'ios.permission.BLUETOOTH_PERIPHERAL',
      }
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      BLOCKED: 'blocked',
      UNAVAILABLE: 'unavailable',
    },
  };
});

// Mock NativeEventEmitter
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  
  const mockEmitter = {
    addListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
    removeAllListeners: jest.fn(),
  };

  return {
    ...RN,
    NativeEventEmitter: jest.fn(() => mockEmitter),
    Platform: {
      ...RN.Platform,
      OS: 'android',
      select: jest.fn(obj => obj.android || obj.default),
    },
  };
});

// Mock React Native
jest.mock('react-native', () => {
  return {
    NativeModules: {
      BleManager: {
        addListener: jest.fn(),
        removeListeners: jest.fn(),
      },
      UIManager: {
        RCTView: {
          directEventTypes: {},
        },
      },
    },
    NativeEventEmitter: jest.fn(() => ({
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeAllListeners: jest.fn(),
    })),
    Platform: {
      OS: 'android',
      select: jest.fn(obj => obj.android || obj.default),
    },
    StyleSheet: {
      create: jest.fn(styles => styles),
    },
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    ScrollView: 'ScrollView',
    TextInput: 'TextInput',
    ActivityIndicator: 'ActivityIndicator',
    Alert: {
      alert: jest.fn(),
    },
  };
});

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
    },
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

// Increase test timeout
jest.setTimeout(30000);