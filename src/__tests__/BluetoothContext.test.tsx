import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { BluetoothProvider, useBluetooth } from '../context/BluetoothContext';
import { BluetoothActionType } from '../types/bluetoothTypes';
import BleManager from 'react-native-ble-manager';
import * as permissionUtils from '../utils/permissionUtils';
import * as dataUtils from '../utils/dataUtils';

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
            Notify: 'Notify',
            notify: true,
          },
        },
        {
          service: 'FFE0',
          characteristic: 'FFE2',
          properties: {
            Write: 'Write',
            write: true,
          },
        },
      ],
    }),
  ),
  startNotification: jest.fn(() => Promise.resolve()),
  stopNotification: jest.fn(() => Promise.resolve()),
  write: jest.fn(() => Promise.resolve()),
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

  test('initializes correctly', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result, waitForNextUpdate } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Check initial state
    expect(result.current.isInitialized).toBe(true);
    expect(result.current.isBluetoothOn).toBe(true);
    expect(result.current.hasPermissions).toBe(true);
    expect(BleManager.start).toHaveBeenCalled();
    expect(permissionUtils.checkBluetoothState).toHaveBeenCalled();
    expect(permissionUtils.requestBluetoothPermissions).toHaveBeenCalled();
  });

  test('scan devices functionality', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result, waitForNextUpdate } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Start scan
    await act(async () => {
      const scanResult = await result.current.scanDevices();
      expect(scanResult).toBe(true);
    });

    expect(BleManager.scan).toHaveBeenCalled();
    expect(result.current.isScanning).toBe(true);

    // Simulate device discovery
    await act(async () => {
      mockEventCallbacks.discoverPeripheral({
        id: 'device-1',
        name: 'OBD Device',
        rssi: -65,
      });
    });

    expect(result.current.discoveredDevices).toHaveLength(1);
    expect(result.current.discoveredDevices[0].name).toBe('OBD Device');

    // Simulate scan timeout
    await act(async () => {
      jest.runAllTimers();
    });

    expect(BleManager.stopScan).toHaveBeenCalled();
    expect(result.current.isScanning).toBe(false);
  });

  test('connect to device functionality', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result, waitForNextUpdate } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Connect to device
    await act(async () => {
      const connectResult = await result.current.connectToDevice('device-1');
      expect(connectResult).toBe(true);
    });

    expect(BleManager.connect).toHaveBeenCalledWith('device-1');
    expect(BleManager.retrieveServices).toHaveBeenCalledWith('device-1');
    expect(BleManager.startNotification).toHaveBeenCalled();
    expect(result.current.connectedDevice).not.toBeNull();
    expect(result.current.connectionDetails).not.toBeNull();
    expect(result.current.isConnected).toBe(true);
  });

  test('disconnect functionality', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result, waitForNextUpdate } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Connect to device first
    await act(async () => {
      await result.current.connectToDevice('device-1');
    });

    // Disconnect
    await act(async () => {
      const disconnectResult = await result.current.disconnect('device-1');
      expect(disconnectResult).toBe(true);
    });

    expect(BleManager.disconnect).toHaveBeenCalledWith('device-1');
    expect(BleManager.stopNotification).toHaveBeenCalled();
    expect(result.current.connectedDevice).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  test('handles Bluetooth state changes', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result, waitForNextUpdate } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Simulate Bluetooth turning off
    await act(async () => {
      mockEventCallbacks.updateState({ state: 'off' });
    });

    expect(result.current.isBluetoothOn).toBe(false);

    // Simulate Bluetooth turning back on
    await act(async () => {
      mockEventCallbacks.updateState({ state: 'on' });
    });

    expect(result.current.isBluetoothOn).toBe(true);
  });

  test('handles unexpected disconnections', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result, waitForNextUpdate } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Connect to device first
    await act(async () => {
      await result.current.connectToDevice('device-1');
    });

    // Verify connected state
    expect(result.current.connectedDevice).not.toBeNull();
    expect(result.current.isConnected).toBe(true);

    // Simulate unexpected disconnection
    await act(async () => {
      mockEventCallbacks.disconnectPeripheral({ peripheral: 'device-1' });
    });

    expect(result.current.connectedDevice).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  test('permissions request functionality', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result, waitForNextUpdate } = renderHook(() => useBluetooth(), { wrapper });

    // Wait for initialization
    await waitForNextUpdate();

    // Mock permission request to return false
    (permissionUtils.requestBluetoothPermissions as jest.Mock).mockResolvedValueOnce(false);

    // Request permissions
    await act(async () => {
      const permissionResult = await result.current.requestPermissions();
      expect(permissionResult).toBe(false);
    });

    expect(result.current.hasPermissions).toBe(false);

    // Mock permission request to return true again
    (permissionUtils.requestBluetoothPermissions as jest.Mock).mockResolvedValueOnce(true);

    // Request permissions again
    await act(async () => {
      const permissionResult = await result.current.requestPermissions();
      expect(permissionResult).toBe(true);
    });

    expect(result.current.hasPermissions).toBe(true);
  });
});
