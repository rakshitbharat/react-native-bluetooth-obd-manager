import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { BluetoothProvider, useBluetooth } from '../context/BluetoothContext';
import BleManager from 'react-native-ble-manager';

// Mock BleManager
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
        uuid: 'FFE1', 
        properties: { 
          notify: true 
        } 
      },
      { 
        uuid: 'FFE2', 
        properties: { 
          write: true 
        } 
      }
    ]
  })),
  startNotification: jest.fn(() => Promise.resolve()),
  write: jest.fn(() => Promise.resolve()),
}));

// Mock native event emitter
jest.mock('react-native', () => {
  const eventEmitter = {
    addListener: jest.fn(() => ({
      remove: jest.fn()
    })),
    removeAllListeners: jest.fn()
  };
  
  return {
    NativeEventEmitter: jest.fn(() => eventEmitter),
    Platform: { OS: 'android' },
  };
});

describe('BluetoothContext', () => {
  test('initializes correctly', async () => {
    const wrapper = ({ children }) => (
      <BluetoothProvider>
        {children}
      </BluetoothProvider>
    );
    
    const { result, waitForNextUpdate } = renderHook(() => useBluetooth(), { wrapper });
    
    // Wait for initialization
    await waitForNextUpdate();
    
    // Check initial state
    expect(result.current.isInitialized).toBe(true);
    expect(result.current.isBluetoothOn).toBe(true);
    expect(BleManager.start).toHaveBeenCalled();
  });
  
  test('scan devices', async () => {
    const wrapper = ({ children }) => (
      <BluetoothProvider>
        {children}
      </BluetoothProvider>
    );
    
    const { result, waitForNextUpdate } = renderHook(() => useBluetooth(), { wrapper });
    
    // Wait for initialization
    await waitForNextUpdate();
    
    // Start scan
    await act(async () => {
      await result.current.scanDevices();
    });
    
    expect(BleManager.scan).toHaveBeenCalled();
    expect(result.current.isScanning).toBe(true);
    
    // Simulate scan completion
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    
    expect(BleManager.stopScan).toHaveBeenCalled();
  });
});
