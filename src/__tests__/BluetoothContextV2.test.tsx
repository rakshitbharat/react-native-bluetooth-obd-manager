import { it, describe, expect } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-native';
import React from 'react';

import { BluetoothProvider, useBluetooth } from '../context/BluetoothContext';

// Mock BleManager
jest.mock('react-native-ble-manager', () => ({
  start: jest.fn(() => Promise.resolve()),
  checkState: jest.fn(() => Promise.resolve('on')),
  scan: jest.fn(() => Promise.resolve()),
  stopScan: jest.fn(() => Promise.resolve()),
  connect: jest.fn(() => Promise.resolve()),
  disconnect: jest.fn(() => Promise.resolve()),
  retrieveServices: jest.fn(() =>
    Promise.resolve({
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
    }),
  ),
  write: jest.fn(() => Promise.resolve()),
  writeWithoutResponse: jest.fn(() => Promise.resolve()),
  startNotification: jest.fn(() => Promise.resolve()),
  stopNotification: jest.fn(() => Promise.resolve()),
  isPeripheralConnected: jest.fn(() => Promise.resolve(false)),
}));

// Mock permissions
jest.mock('../utils/permissionUtils', () => ({
  requestBluetoothPermissions: jest.fn(() => Promise.resolve(true)),
  checkBluetoothState: jest.fn(() => Promise.resolve(true)),
  checkBluetoothPermissions: jest.fn(() => Promise.resolve(true)),
}));

// Mock event emitter
jest.mock('react-native', () => {
  const reactNative = jest.requireActual('react-native');
  return {
    ...reactNative,
    NativeModules: {
      ...reactNative.NativeModules,
      BleManager: {
        addListener: jest.fn(),
        removeListeners: jest.fn(),
      },
    },
    NativeEventEmitter: jest.fn(() => ({
      addListener: jest.fn(() => ({
        remove: jest.fn(),
      })),
      removeAllListeners: jest.fn(),
    })),
  };
});

describe('BluetoothContextV2', () => {
  it('should initialize with BluetoothProvider', async () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = renderHook(() => useBluetooth(), { wrapper });
    
    await act(async () => {
      // Wait for any async initialization
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current).toBeDefined();
  });
});
