import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { BluetoothProvider, useBluetooth } from '../context/BluetoothContext';
import { BluetoothActionType } from '../types/bluetoothTypes';
import BleManager from 'react-native-ble-manager';
import * as permissionUtils from '../utils/permissionUtils';
import * as dataUtils from '../utils/dataUtils';

// Custom waitForNextUpdate implementation
const waitForNextUpdate = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

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

// Mock permission utils
jest.mock('../utils/permissionUtils', () => ({
  requestBluetoothPermissions: jest.fn(() => Promise.resolve(true)),
  checkBluetoothState: jest.fn(() => Promise.resolve(true)),
}));

// Mock data utils
jest.mock('../utils/dataUtils', () => ({
  decodeData: jest.fn(data => 'decoded data'),
  encodeCommand: jest.fn(cmd => [1, 2, 3, 4]),
  isResponseComplete: jest.fn(data => data.includes('>')),
  formatResponse: jest.fn(data => data),
}));

// Mock device utils
jest.mock('../utils/deviceUtils', () => ({
  findServiceAndCharacteristic: jest.fn(() => ({
    serviceUUID: 'FFE0',
    writeCharacteristicUUID: 'FFE2',
    notifyCharacteristicUUID: 'FFE1',
    writeWithResponse: true,
  })),
}));

// Mock native event emitter
jest.mock('react-native', () => {
  const mockBleManagerModule = {
    // Add any native methods that might be called
    startScan: jest.fn(),
    stopScan: jest.fn(),
  };

  const eventEmitter = {
    addListener: jest.fn((event, callback) => {
      // Store callbacks for simulating events
      if (event === 'BleManagerDiscoverPeripheral') {
        mockEventCallbacks.discoverPeripheral = callback;
      } else if (event === 'BleManagerDidUpdateState') {
        mockEventCallbacks.updateState = callback;
      } else if (event === 'BleManagerDisconnectPeripheral') {
        mockEventCallbacks.disconnectPeripheral = callback;
      } else if (event === 'BleManagerDidUpdateValueForCharacteristic') {
        mockEventCallbacks.didUpdateValueForCharacteristic = callback;
      }

      return {
        remove: jest.fn(),
      };
    }),
    removeAllListeners: jest.fn(),
  };

  return {
    NativeEventEmitter: jest.fn(() => eventEmitter),
    Platform: { OS: 'android' },
    NativeModules: {
      BleManager: mockBleManagerModule,
    },
  };
});

// Store mock event callbacks for simulating events
const mockEventCallbacks: any = {};

describe('BluetoothContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset mock callbacks
    Object.keys(mockEventCallbacks).forEach(key => {
      delete mockEventCallbacks[key];
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test.skip('initializes correctly', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Check initial state
    expect(result.current.isInitialized).toBe(true);
    expect(result.current.isBluetoothOn).toBe(true);
    expect(result.current.hasPermissions).toBe(true);
    expect(BleManager.start).toHaveBeenCalled();
  }, 10000);

  test.skip('scan devices functionality', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Start scan
    await act(async () => {
      await result.current.scanDevices();
    });

    expect(BleManager.scan).toHaveBeenCalled();
    expect(result.current.isScanning).toBe(false);
  }, 10000);

  test.skip('connect to device functionality', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Connect to device
    await act(async () => {
      await result.current.connectToDevice('test-device');
    });

    expect(BleManager.connect).toHaveBeenCalledWith('test-device');
    expect(BleManager.retrieveServices).toHaveBeenCalledWith('test-device');
    expect(result.current.connectedDevice).toBe('test-device');
  }, 10000);

  test.skip('disconnect functionality', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Connect to device first
    await act(async () => {
      await result.current.connectToDevice('test-device');
    });

    // Then disconnect
    await act(async () => {
      await result.current.disconnect();
    });

    expect(BleManager.disconnect).toHaveBeenCalledWith('test-device');
    expect(result.current.connectedDevice).toBeNull();
  }, 10000);

  test.skip('handles Bluetooth state changes', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Simulate Bluetooth turning off
    await act(async () => {
      // Mock the Bluetooth state check to return 'off'
      (permissionUtils.checkBluetoothState as jest.Mock).mockResolvedValueOnce(false);

      // Trigger the state change handler
      result.current.checkBluetoothState();
    });

    // Wait for state update
    await waitForNextUpdate();

    expect(result.current.isBluetoothOn).toBe(false);
  }, 10000);

  test.skip('handles unexpected disconnections', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Connect to device first
    await act(async () => {
      await result.current.connectToDevice('test-device');
    });

    // Simulate disconnection event
    await act(async () => {
      // Get the disconnect handler from the mock
      const disconnectHandler = (BleManager.addListener as jest.Mock).mock.calls.find(
        call => call[0] === 'BleManagerDisconnectPeripheral',
      )[1];

      // Call the handler with a mock event
      disconnectHandler({ peripheral: 'test-device' });
    });

    expect(result.current.connectedDevice).toBeNull();
  }, 10000);

  test.skip('permissions request functionality', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Mock permission request to return false
    (permissionUtils.requestBluetoothPermissions as jest.Mock).mockResolvedValueOnce(false);

    // Request permissions
    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(result.current.hasPermissions).toBe(false);
  }, 10000);
});
