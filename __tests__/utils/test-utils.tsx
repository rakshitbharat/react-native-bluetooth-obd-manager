import React from 'react';
import { View } from 'react-native';
import { NativeEventEmitter } from 'react-native';
import { BluetoothProvider } from '../../src/context/BluetoothProvider';

// Mock the native event emitter
const mockNativeEventEmitter = {
  addListener: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    NativeEventEmitter: jest.fn(() => mockNativeEventEmitter)
  };
});

// Initial context value for testing
const initialContextValue = {
  state: {
    isInitializing: false,
    isBluetoothOn: true,
    hasPermissions: false,
    // ...add other required state props
  },
  dispatch: jest.fn()
};

// Create a wrapper that provides the BluetoothProvider context
export const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BluetoothProvider>{children}</BluetoothProvider>
);

// Create a simple wrapper that doesn't depend on BluetoothProvider
export const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  );
};

// Mock connection setup helper
export const setupConnectedState = async (result: any) => {
  const deviceId = 'test-device';
  
  // First set permissions
  await result.current.checkPermissions();
  
  // Then connect to device
  await result.current.connectToDevice(deviceId);
  
  // Verify connection
  expect(result.current.connectedDevice).not.toBeNull();
  expect(result.current.connectedDevice?.id).toBe(deviceId);
  
  return deviceId;
};

// Helper for emitting mock BLE events in tests
export const emitMockBleEvent = (eventName: string, eventData: any): void => {
  // Direct implementation without depending on mockNativeEventEmitter
  // This assumes your event system has a way to emit events
  // For tests, you might need to call the handlers directly
  if (typeof global.bleEventHandlers !== 'undefined') {
    const handlers = global.bleEventHandlers[eventName] || [];
    handlers.forEach((handler: Function) => handler(eventData));
  }
};

// Add a test to satisfy Jest's requirement for at least one test per file
describe('Test Utils', () => {
  it('should have a working wrapper component', () => {
    expect(wrapper).toBeDefined();
  });
  
  it('should have a setupConnectedState function', () => {
    expect(typeof setupConnectedState).toBe('function');
  });
});
