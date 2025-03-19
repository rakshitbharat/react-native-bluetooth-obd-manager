import { NativeEventEmitter, NativeModules } from 'react-native';
import BleManager from 'react-native-ble-manager';

import { BluetoothErrorType, BluetoothOBDError } from './errorUtils';
import type { BluetoothState } from '../types/bluetoothTypes';

// BLE Manager module name
const BleManagerModule = NativeModules.BleManager;
const bleEmitter = new NativeEventEmitter(BleManagerModule);

interface BleStateChangeEvent {
  state: 'on' | 'off';
}

interface BleDisconnectEvent {
  peripheral: string;
}

interface BleDataEvent {
  peripheral: string;
  value: number[];
}

// Initialize Bluetooth functionality
export const initializeBluetooth = async (): Promise<BluetoothState> => {
  try {
    await BleManager.start({ showAlert: false });
    return {
      isInitialized: true,
      isBluetoothOn: false,
      hasPermissions: false,
      isScanning: false,
      isConnected: false,
      isStreaming: false,
      devices: [],
      discoveredDevices: [],
      connectedDevice: null,
      connectionDetails: null,
      error: null,
      pendingCommand: null,
    };
  } catch (error) {
    throw new BluetoothOBDError(
      BluetoothErrorType.INITIALIZATION_ERROR,
      `Failed to initialize Bluetooth: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

// Set up Bluetooth event handlers
export const setupEventHandlers = (handlers: {
  onStateChange?: (state: boolean) => void;
  onDeviceDisconnect?: (deviceId: string) => void;
  onData?: (data: BleDataEvent) => void;
}) => {
  const { onStateChange, onDeviceDisconnect, onData } = handlers;

  // State change handler
  const stateChangeListener = onStateChange
    ? bleEmitter.addListener('BleManagerDidUpdateState', (event: BleStateChangeEvent) => {
        onStateChange(event.state === 'on');
      })
    : null;

  // Disconnect handler
  const disconnectListener = onDeviceDisconnect
    ? bleEmitter.addListener('BleManagerDisconnectPeripheral', (event: BleDisconnectEvent) => {
        onDeviceDisconnect(event.peripheral);
      })
    : null;

  // Data handler
  const dataListener = onData
    ? bleEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', onData)
    : null;

  // Return cleanup function
  return () => {
    if (stateChangeListener) stateChangeListener.remove();
    if (disconnectListener) disconnectListener.remove();
    if (dataListener) dataListener.remove();
  };
};

// Helper function to handle device discovery
export const handleDeviceDiscovery = (
  device: { name?: string; id: string; rssi?: number },
  onDeviceFound: (device: { name: string; id: string; rssi?: number }) => void,
) => {
  if (device && (device.name || device.id)) {
    onDeviceFound({
      ...device,
      name: device.name || `Device (${device.id})`,
    });
  }
};
