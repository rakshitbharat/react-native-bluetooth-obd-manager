import React from 'react';
import { BluetoothProvider } from '../../src/context/BluetoothProvider';
import type { ReactNode } from 'react';
import { mockNativeEventEmitter } from '../mocks/react-native';

const TestWrapper = ({ children }: { children: ReactNode }) => {
  return React.createElement(BluetoothProvider, null, children);
};

export const createWrapper = () => ({ wrapper: TestWrapper });

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
