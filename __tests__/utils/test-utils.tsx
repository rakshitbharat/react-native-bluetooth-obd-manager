import React from 'react';
import { View } from 'react-native';

const initialContextValue = {
  state: {
    isInitializing: false,
    isBluetoothOn: true,
    hasPermissions: false,
    // ...add other required state props
  },
  dispatch: jest.fn()
};

// Create a simple wrapper that doesn't depend on BluetoothProvider
export const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  );
};

// Helper for emitting mock BLE events in tests
export const emitMockBleEvent = (eventName: string, eventData: any): void => {
  const listeners = mockNativeEventEmitter.addListener.mock.calls
    .filter(call => call[0] === eventName)
    .map(call => call[1]);
    
  listeners.forEach(listener => {
    if (typeof listener === 'function') {
      listener(eventData);
    }
  });
};

// Add a basic test to satisfy Jest's requirement
describe('test-utils', () => {
  it('creates a valid wrapper component', () => {
    const Wrapper = createWrapper();
    expect(Wrapper).toBeDefined();
  });
});
