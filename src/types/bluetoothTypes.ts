import { Peripheral } from 'react-native-ble-manager';

export interface ConnectionDetails {
  serviceUUID: string;
  writeCharacteristicUUID: string;
  notifyCharacteristicUUID: string;
  writeWithResponse: boolean;
}

export interface BluetoothState {
  isInitialized: boolean;
  isBluetoothOn: boolean;
  hasPermissions: boolean;
  isScanning: boolean;
  discoveredDevices: any[];
  connectedDevice: any | null;
  connectionDetails: ConnectionDetails | null;
  isStreaming: boolean;
  pendingCommand: string | null;
  responseData: string | null;
  error: string | null;
}

export enum BluetoothActionType {
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
}

export type BluetoothAction =
  | { type: BluetoothActionType.INITIALIZE_SUCCESS }
  | { type: BluetoothActionType.INITIALIZE_FAILURE }
  | { type: BluetoothActionType.UPDATE_BLUETOOTH_STATE; payload: boolean }
  | { type: BluetoothActionType.UPDATE_PERMISSIONS; payload: boolean }
  | { type: BluetoothActionType.SCAN_START }
  | { type: BluetoothActionType.SCAN_STOP }
  | { type: BluetoothActionType.DEVICE_DISCOVERED; payload: Peripheral }
  | { type: BluetoothActionType.CONNECT_START }
  | {
      type: BluetoothActionType.CONNECT_SUCCESS;
      payload: { device: Peripheral; details: ConnectionDetails };
    }
  | { type: BluetoothActionType.CONNECT_FAILURE; payload?: string }
  | { type: BluetoothActionType.DISCONNECT_SUCCESS }
  | { type: BluetoothActionType.SEND_COMMAND; payload: string }
  | { type: BluetoothActionType.RECEIVE_DATA; payload: string }
  | { type: BluetoothActionType.COMPLETE_COMMAND }
  | { type: BluetoothActionType.RESET_STREAM }
  | { type: BluetoothActionType.SET_ERROR; payload: string };
