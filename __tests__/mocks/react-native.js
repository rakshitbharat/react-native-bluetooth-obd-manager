// Mock for React Native components and APIs
module.exports = {
  ActionSheetIOS: {
    showActionSheetWithOptions: jest.fn(),
    showShareActionSheetWithOptions: jest.fn(),
    dismissActionSheet: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  AppRegistry: {
    registerComponent: jest.fn(),
  },
  AppState: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    currentState: 'active',
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  NativeModules: {},
  Platform: {
    OS: 'ios',
    select: jest.fn(obj => obj.ios),
  },
  PermissionsAndroid: {
    check: jest.fn(),
    request: jest.fn(),
  },
  StyleSheet: {
    create: (styles) => styles,
  },
  // Add any other React Native APIs used in your tests
};
