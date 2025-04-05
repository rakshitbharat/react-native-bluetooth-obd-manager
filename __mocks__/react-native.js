const ActionSheetIOS = {
  showActionSheetWithOptions: jest.fn(),
  showShareActionSheetWithOptions: jest.fn(),
};

module.exports = {
  Platform: {
    OS: 'ios',
    select: jest.fn(obj => obj.ios),
  },
  NativeModules: {},
  NativeEventEmitter: jest.fn(),
  ActionSheetIOS,
};
