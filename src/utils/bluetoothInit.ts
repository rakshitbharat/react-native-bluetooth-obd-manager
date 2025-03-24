import { NativeEventEmitter, NativeModules } from 'react-native';
import BleManager from 'react-native-ble-manager';

import { BluetoothErrorType, BluetoothOBDError } from './errorUtils';
import type { BluetoothState } from '../types/bluetoothTypes';

// BLE Manager module name
const BleManagerModule = NativeModules.BleManager;

// Update event type definitions
interface BleEventMap {
  BleManagerDidUpdateState: {
    state: 'on' | 'off' | 'turning_on' | 'turning_off' | 'unauthorized' | 'unknown';
  };
  BleManagerDisconnectPeripheral: { peripheral: string };
  BleManagerDidUpdateValueForCharacteristic: { value: number[]; peripheral: string };
}

// Update event handler type
type BleEventHandler<T extends keyof BleEventMap> = (event: BleEventMap[T]) => void;

// Create type-safe event emitter wrapper
function createTypedEventEmitter(emitter: NativeEventEmitter) {
  return {
    addListener<T extends keyof BleEventMap>(eventType: T, handler: BleEventHandler<T>) {
      return emitter.addListener(eventType, handler as unknown as (event: unknown) => void);
    },
  };
}

// Update BleManager module type cast for event emitter
const typedBleEmitter = createTypedEventEmitter(
  new NativeEventEmitter(BleManagerModule as unknown as typeof NativeModules),
);

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

// Use the typed emitter in setupEventHandlers
export const setupEventHandlers = (handlers: {
  onStateChange?: (state: boolean) => void;
  onDeviceDisconnect?: (deviceId: string) => void;
  onData?: (data: BleEventMap['BleManagerDidUpdateValueForCharacteristic']) => void;
}) => {
  const { onStateChange, onDeviceDisconnect, onData } = handlers;

  // State change handler
  const stateChangeListener = onStateChange
    ? typedBleEmitter.addListener('BleManagerDidUpdateState', event => {
        onStateChange(event.state === 'on');
      })
    : null;

  // Disconnect handler
  const disconnectListener = onDeviceDisconnect
    ? typedBleEmitter.addListener('BleManagerDisconnectPeripheral', event => {
        onDeviceDisconnect(event.peripheral);
      })
    : null;

  // Data handler
  const dataListener = onData
    ? typedBleEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', onData)
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
