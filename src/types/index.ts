// src/types/index.ts

import type { Dispatch } from 'react';
import type { Peripheral as BlePeripheral } from 'react-native-ble-manager';

// Re-export Peripheral interface with our additions
export interface Peripheral extends BlePeripheral {
  id: string;
  name?: string;
  rssi?: number;
  advertising?: {
    isConnectable?: boolean;
    serviceUUIDs?: string[];
    manufacturerData?: Buffer;
    serviceData?: Record<string, Buffer>;
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

// Define BleError interface locally instead of importing
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
  /** The UUID of the primary service used for communication */
  serviceUUID: string;
  /** The UUID of the characteristic used for writing commands */
  writeCharacteristicUUID: string;
  /** The UUID of the characteristic used for receiving notifications */
  notifyCharacteristicUUID: string;
  /** Whether the write characteristic supports Write (with response) or WriteWithoutResponse */
  writeType: 'Write' | 'WriteWithoutResponse';
}

/**
 * Extends the base Peripheral type to include prediction flags for OBD compatibility.
 */
export interface PeripheralWithPrediction extends Peripheral {
  /** Indicates if this device is likely an OBD-II adapter based on name heuristics */
  isLikelyOBD?: boolean;
  /** Additional information about prediction reasoning (for debugging) */
  prediction?: string;
}

export interface DeferredPromise<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason: Error) => void;
}

export interface BleDisconnectPeripheralEvent {
  peripheral: string;
  reason?: string;
}

/**
 * Represents a response received as multiple chunks from the BLE device.
 * This is the public structure returned by sendCommandRawChunked.
 */
export interface ChunkedResponse {
  /**
   * An array of Uint8Array, where each element represents a single
   * notification chunk received from the device.
   */
  chunks: Uint8Array[];
  /**
   * An array of number[], mirroring `chunks` but preserving the raw numeric
   * byte values exactly as received from the underlying react-native-ble-manager library.
   */
  rawResponse: number[][];
}

/**
 * Internal structure used to resolve the command promise within the provider.
 * Contains both Uint8Array chunks and raw number[] chunks.
 * @internal
 */
export interface InternalCommandResponse {
  chunks: Uint8Array[];
  rawResponse: number[][];
}

export interface CommandExecutionState {
  promise: DeferredPromise<string | number[][] | ChunkedResponse>;
  timeoutId: NodeJS.Timeout | null;
  chunks: number[][]; // Updated to store array of number arrays
  expectedReturnType: 'string' | 'bytes' | 'chunked';
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
  /** Whether the Bluetooth adapter is on */
  isBluetoothOn: boolean;
  /** Whether required permissions are granted */
  hasPermissions: boolean; // Reflects status from the last check/request
  /** Whether the BluetoothProvider is still initializing */
  isInitializing: boolean; // Tracks BleManager.start() completion
  /** The most recent error that occurred, if any */
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
  /**
   * Checks if required Bluetooth permissions are granted.
   * @returns Promise resolving to true if permissions are granted, false otherwise
   */
  checkPermissions: () => Promise<boolean>;

  /**
   * Requests Bluetooth permissions from the user.
   * @returns Promise resolving to true if permissions are granted, false otherwise
   */
  requestBluetoothPermissions: () => Promise<boolean>;

  /**
   * Prompts the user to enable Bluetooth if it's not already on.
   * On iOS, this is a no-op as there's no API to open Bluetooth settings.
   */
  promptEnableBluetooth: () => Promise<void>;

  /**
   * Scans for nearby Bluetooth devices.
   * @param scanDuration Duration to scan in milliseconds (default: 5000)
   */
  scanDevices: (scanDuration?: number) => Promise<void>;

  /**
   * Connects to a Bluetooth device.
   * @param deviceId ID of the device to connect to
   * @returns Promise resolving to the connected peripheral
   */
  connectToDevice: (deviceId: string) => Promise<Peripheral>;

  /**
   * Disconnects from the currently connected device.
   */
  disconnect: () => Promise<void>;

  /**
   * Sends a command to the connected ELM327 device and returns the response as a string.
   * @param command The command to send (e.g., "AT Z", "01 0C")
   * @param options Options for command execution
   * @returns Promise resolving to the string response
   */
  sendCommand: (
    command: string,
    options?: { timeout?: number },
  ) => Promise<string>;

  /**
   * Sends a command to the connected ELM327 device and returns the raw response bytes.
   * @param command The command to send
   * @param options Options for command execution
   * @returns Promise resolving to the raw byte response
   */
  sendCommandRaw: (
    command: string,
    options?: { timeout?: number },
  ) => Promise<Uint8Array>;

  /**
   * Sends a command to the connected ELM327 device and returns the response as
   * an array of chunks, preserving the original data packet boundaries.
   * @param command The command to send
   * @param options Options for command execution
   * @returns Promise resolving to the chunked response
   */
  sendCommandRawChunked: (
    command: string,
    options?: { timeout?: number },
  ) => Promise<ChunkedResponse>;

  /**
   * Sets the streaming state.
   * When true, enables automatic inactivity monitoring.
   * @param shouldStream Whether streaming should be active
   */
  setStreaming: (shouldStream: boolean) => void;
}
