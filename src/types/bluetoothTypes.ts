import { BluetoothOBDError } from '../utils/errorUtils';

export interface BluetoothDeviceInfo {
  id: string;
  name?: string;
  rssi?: number;
  manufacturer?: string;
  serviceUUIDs?: string[];
  isConnectable?: boolean;
}

export interface ConnectionDetails {
  serviceUUID: string;
  characteristicUUID: string;
  writeCharacteristicUUID?: string; // Added missing property
  notifyCharacteristicUUID?: string; // Added missing property
  writeWithResponse: boolean;
  mtu?: number;
  device?: BluetoothDeviceInfo; // Added missing property
}

export interface BluetoothState {
  isInitialized: boolean;
  isBluetoothOn: boolean;
  hasPermissions: boolean;
  isScanning: boolean;
  isConnected: boolean;
  isStreaming: boolean;
  devices: BluetoothDeviceInfo[];
  discoveredDevices: BluetoothDeviceInfo[];
  connectedDevice: BluetoothDeviceInfo | null;
  connectionDetails: ConnectionDetails | null;
  error: BluetoothOBDError | null;
  pendingCommand: string | null;
}

export type TransportType = 'classic' | 'ble' | 'auto';

export interface BluetoothConfig {
  transport?: TransportType;
  requestMTU?: number;
  autoConnect?: boolean;
  timeout?: number;
}

export interface ScanOptions {
  duration?: number;
  allowDuplicates?: boolean;
  scanMode?: 'lowPower' | 'balanced' | 'lowLatency';
  matchMode?: 'aggressive' | 'sticky';
  matchNum?: 'one' | 'few' | 'max';
  callbackType?: 'all' | 'first' | 'last';
}

export type BluetoothServiceType = 'primary' | 'secondary';

export interface BluetoothService {
  uuid: string;
  deviceID: string;
  type?: BluetoothServiceType;
  characteristics?: BluetoothCharacteristic[];
}

export interface BluetoothCharacteristic {
  uuid: string;
  serviceUUID: string;
  deviceID: string;
  isReadable?: boolean;
  isWritableWithResponse?: boolean;
  isWritableWithoutResponse?: boolean;
  isNotifiable?: boolean;
  isIndicatable?: boolean;
  value?: number[];
}

export interface BluetoothDescriptor {
  uuid: string;
  characteristicUUID: string;
  serviceUUID: string;
  deviceID: string;
  value?: number[];
}

export enum BluetoothActionType {
  // Existing action types
  INITIALIZE_SUCCESS = 'INITIALIZE_SUCCESS',
  INITIALIZE_FAILURE = 'INITIALIZE_FAILURE',
  UPDATE_BLUETOOTH_STATE = 'UPDATE_BLUETOOTH_STATE',
  UPDATE_PERMISSIONS = 'UPDATE_PERMISSIONS',
  SCAN_START = 'SCAN_START',
  SCAN_STOP = 'SCAN_STOP',
  DEVICE_DISCOVERED = 'DEVICE_DISCOVERED',
  CONNECT_START = 'CONNECT_START',
  CONNECT_SUCCESS = 'CONNECT_SUCCESS',
  CONNECT_FAILURE = 'CONNECT_FAILURE',
  DISCONNECT_SUCCESS = 'DISCONNECT_SUCCESS',
  SEND_COMMAND = 'SEND_COMMAND',
  RECEIVE_DATA = 'RECEIVE_DATA',
  COMPLETE_COMMAND = 'COMPLETE_COMMAND',
  RESET_STREAM = 'RESET_STREAM',
  SET_ERROR = 'SET_ERROR',

  // Add missing action types from bluetoothReducer.ts
  SET_SCANNING = 'SET_SCANNING',
  SET_CONNECTED = 'SET_CONNECTED',
  SET_DEVICES = 'SET_DEVICES',
  ADD_DEVICE = 'ADD_DEVICE',
  REMOVE_DEVICE = 'REMOVE_DEVICE',
  CLEAR_ERROR = 'CLEAR_ERROR',
  SET_CONNECTION_DETAILS = 'SET_CONNECTION_DETAILS',
  RESET = 'RESET',
}

export type BluetoothAction = {
  type: BluetoothActionType | string;
  payload?: any;
};

// Define a context interface to fix errors in useBluetooth
export interface BluetoothContextValue {
  // State properties
  isInitialized: boolean;
  isScanning: boolean;
  isConnected: boolean;
  isBluetoothOn: boolean;
  hasPermissions: boolean;
  devices: BluetoothDeviceInfo[];
  discoveredDevices: BluetoothDeviceInfo[];
  connectedDevice: BluetoothDeviceInfo | null;
  connectionDetails: ConnectionDetails | null;
  error: BluetoothOBDError | null;
  isStreaming: boolean;
  pendingCommand: string | null;

  // Methods used in hooks
  initialize: () => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
  scanDevices: (timeoutMs?: number) => Promise<boolean>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  disconnect: (deviceId?: string) => Promise<boolean>;
  sendCommand: (command: string, timeoutMs?: number) => Promise<string>;
  reconnectToLastDevice: () => Promise<boolean>;
  getRecentDevices: () => BluetoothDeviceInfo[];
}
