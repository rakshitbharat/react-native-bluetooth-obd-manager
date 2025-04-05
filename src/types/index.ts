// src/types/index.ts

import type { Dispatch } from 'react';

// Define types for react-native-ble-manager since they're not exported
export interface Peripheral {
  id: string;
  name?: string;
  rssi?: number;
  advertising?: {
    isConnectable?: boolean;
    serviceUUIDs?: string[];
    manufacturerData?: any;
    serviceData?: any;
    txPowerLevel?: number;
  };
}

export type BleManagerState = 
  | 'on'
  | 'off'
  | 'turning_on'
  | 'turning_off'
  | 'unknown'
  | 'resetting'
  | 'unsupported'
  | 'unauthorized';

export interface BleManagerDidUpdateValueForCharacteristicEvent {
  peripheral: string;
  characteristic: string;
  service: string;
  value: number[];
}

// Define our own BleError interface since react-native-ble-manager doesn't export one
export interface BleError {
  errorCode: string;
  message: string;
  attErrorCode?: number;
}

/**
 * Configuration details for the active BLE connection to an ELM327 device.
 * Stored once a compatible service/characteristic set is found.
 */
export interface ActiveDeviceConfig {
  serviceUUID: string;
  writeCharacteristicUUID: string;
  notifyCharacteristicUUID: string;
  writeType: 'Write' | 'WriteWithoutResponse'; // Determined write method
}

/**
 * Extends the base Peripheral type to include our predictive flag.
 * TODO: Implement the logic to set isLikelyOBD during scanning.
 */
export interface PeripheralWithPrediction extends Peripheral {
  isLikelyOBD?: boolean; // Predictive flag based on device name heuristics
  prediction?: string;
}

export interface DeferredPromise<T = any> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

export interface BleDisconnectPeripheralEvent {
  peripheral: string;
  reason?: string;
}

export interface CommandExecutionState {
  promise: DeferredPromise<string | Uint8Array>;
  timeoutId: NodeJS.Timeout | null;
  responseBuffer: number[];
  expectedReturnType: 'string' | 'bytes';
}

export interface CurrentCommand {
  timeoutId?: NodeJS.Timeout;
  responseBuffer: number[]; // Change to store raw bytes
  expectedReturnType: 'string' | 'bytes';
}

/**
 * Represents the state managed by the Bluetooth context and reducer.
 */
export interface BluetoothState {
  // Core BLE State
  isBluetoothOn: boolean;
  hasPermissions: boolean; // Reflects status from the last check/request
  isInitializing: boolean; // Tracks BleManager.start() completion
  error: BleError | Error | null; // Stores the last encountered error

  // Scanning State
  isScanning: boolean;
  discoveredDevices: PeripheralWithPrediction[];

  // Connection State
  isConnecting: boolean;
  isDisconnecting: boolean;
  connectedDevice: Peripheral | null; // The currently connected peripheral
  activeDeviceConfig: ActiveDeviceConfig | null; // Config for the connected device

  // Command State
  isAwaitingResponse: boolean; // True if sendCommand is waiting for '>'
  // commandResponseBuffer: string; // Internal buffer for assembling responses (Maybe managed differently)

  // Streaming State (TODO)
  isStreaming: boolean; // Is a polling loop intended to be active?
  lastSuccessfulCommandTimestamp: number | null; // Timestamp for inactivity timeout
}

/**
 * Actions that can be dispatched to the Bluetooth reducer.
 * Uses a discriminated union based on the 'type' property.
 */
export type BluetoothAction =
  // Initialization & State
  | { type: 'SET_INITIALIZING'; payload: boolean }
  | { type: 'SET_BLUETOOTH_STATE'; payload: boolean }
  | { type: 'SET_PERMISSIONS_STATUS'; payload: boolean }
  | { type: 'SET_ERROR'; payload: BleError | Error | null }
  | { type: 'RESET_STATE' } // Potential action to reset to initial state

  // Scanning Actions
  | { type: 'SCAN_START' }
  | { type: 'SCAN_STOP' }
  | { type: 'DEVICE_FOUND'; payload: PeripheralWithPrediction }
  | { type: 'CLEAR_DISCOVERED_DEVICES' } // Might be part of SCAN_START

  // Connection Actions
  | { type: 'CONNECT_START' }
  | {
      type: 'CONNECT_SUCCESS';
      payload: {
        device: Peripheral;
        config: ActiveDeviceConfig;
      };
    }
  | { type: 'CONNECT_FAILURE'; payload: BleError | Error }
  | { type: 'DEVICE_DISCONNECTED' } // Triggered by listener or manual disconnect
  | { type: 'DISCONNECT_START' }
  | { type: 'DISCONNECT_SUCCESS' } // Often implicitly handled by DEVICE_DISCONNECTED
  | { type: 'DISCONNECT_FAILURE'; payload: BleError | Error }

  // Command Actions (Internal state management for sendCommand)
  | { type: 'SEND_COMMAND_START' }
  | { type: 'COMMAND_SUCCESS'; payload?: string | Uint8Array } // Success, reset flags
  | { type: 'COMMAND_FAILURE'; payload: BleError | Error } // Write error or timeout
  | { type: 'COMMAND_TIMEOUT' } // Specific timeout error
  | { type: 'DATA_RECEIVED'; payload: number[] } // Raw byte array value from notification

  // Streaming Actions (TODO)
  | { type: 'SET_STREAMING_STATUS'; payload: boolean }
  | { type: 'UPDATE_LAST_SUCCESS_TIMESTAMP' }
  | { type: 'STREAMING_INACTIVITY_TIMEOUT' }; // Internal action for auto-stop

/**
 * Type for the dispatch function provided by the Bluetooth context.
 */
export type BluetoothDispatch = Dispatch<BluetoothAction>;

/**
 * Structure of the state context provided to consumers.
 */
export type BluetoothContextState = BluetoothState;

/**
 * Structure of the object returned by the `useBluetooth` hook.
 */
export interface UseBluetoothResult extends BluetoothContextState {
  // Action Functions exposed to the user:
  checkPermissions: () => Promise<boolean>;
  scanDevices: (scanDuration?: number) => Promise<void>;
  connectToDevice: (deviceId: string) => Promise<Peripheral>;
  disconnect: () => Promise<void>;
  sendCommand: (
    command: string,
    options?: { timeout?: number },
  ) => Promise<string>;

  // TODO Functions:
  requestBluetoothPermissions: () => Promise<boolean>;
  promptEnableBluetooth: () => Promise<void>;
  sendCommandRaw: (
    command: string,
    options?: { timeout?: number },
  ) => Promise<Uint8Array>; // Or integrate into sendCommand
  setStreaming: (shouldStream: boolean) => void; // For streaming control
}