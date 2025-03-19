import { BluetoothDeviceInfo, ConnectionDetails, BluetoothState } from '../types/bluetoothTypes';
import { BluetoothOBDError } from '../utils/errorUtils';

// Action Types
export enum BluetoothActionType {
  SET_INITIALIZED = 'SET_INITIALIZED',
  SET_BLUETOOTH_ON = 'SET_BLUETOOTH_ON',
  SET_PERMISSIONS = 'SET_PERMISSIONS',
  SET_SCANNING = 'SET_SCANNING',
  SET_CONNECTED = 'SET_CONNECTED',
  SET_STREAMING = 'SET_STREAMING',
  ADD_DEVICE = 'ADD_DEVICE',
  REMOVE_DEVICE = 'REMOVE_DEVICE',
  SET_CONNECTED_DEVICE = 'SET_CONNECTED_DEVICE',
  SET_CONNECTION_DETAILS = 'SET_CONNECTION_DETAILS',
  SET_ERROR = 'SET_ERROR',
  CLEAR_ERROR = 'CLEAR_ERROR',
  SET_PENDING_COMMAND = 'SET_PENDING_COMMAND',
}

// Action Interfaces
export interface SetInitializedAction {
  type: BluetoothActionType.SET_INITIALIZED;
  payload: boolean;
}

export interface SetBluetoothOnAction {
  type: BluetoothActionType.SET_BLUETOOTH_ON;
  payload: boolean;
}

export interface SetPermissionsAction {
  type: BluetoothActionType.SET_PERMISSIONS;
  payload: boolean;
}

export interface SetScanningAction {
  type: BluetoothActionType.SET_SCANNING;
  payload: boolean;
}

export interface SetConnectedAction {
  type: BluetoothActionType.SET_CONNECTED;
  payload: boolean;
}

export interface SetStreamingAction {
  type: BluetoothActionType.SET_STREAMING;
  payload: boolean;
}

export interface AddDeviceAction {
  type: BluetoothActionType.ADD_DEVICE;
  payload: BluetoothDeviceInfo;
}

export interface RemoveDeviceAction {
  type: BluetoothActionType.REMOVE_DEVICE;
  payload: string;
}

export interface SetConnectedDeviceAction {
  type: BluetoothActionType.SET_CONNECTED_DEVICE;
  payload: BluetoothDeviceInfo | null;
}

export interface SetConnectionDetailsAction {
  type: BluetoothActionType.SET_CONNECTION_DETAILS;
  payload: ConnectionDetails | null;
}

export interface SetErrorAction {
  type: BluetoothActionType.SET_ERROR;
  payload: BluetoothOBDError;
}

export interface ClearErrorAction {
  type: BluetoothActionType.CLEAR_ERROR;
}

export interface SetPendingCommandAction {
  type: BluetoothActionType.SET_PENDING_COMMAND;
  payload: string | null;
}

export type BluetoothAction =
  | SetInitializedAction
  | SetBluetoothOnAction
  | SetPermissionsAction
  | SetScanningAction
  | SetConnectedAction
  | SetStreamingAction
  | AddDeviceAction
  | RemoveDeviceAction
  | SetConnectedDeviceAction
  | SetConnectionDetailsAction
  | SetErrorAction
  | ClearErrorAction
  | SetPendingCommandAction;

// Initial State
export const initialState: BluetoothState = {
  isInitialized: false,
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

// Reducer
export const bluetoothReducer = (
  state: BluetoothState,
  action: BluetoothAction,
): BluetoothState => {
  switch (action.type) {
    case BluetoothActionType.SET_INITIALIZED:
      return { ...state, isInitialized: action.payload };
    case BluetoothActionType.SET_BLUETOOTH_ON:
      return { ...state, isBluetoothOn: action.payload };
    case BluetoothActionType.SET_PERMISSIONS:
      return { ...state, hasPermissions: action.payload };
    case BluetoothActionType.SET_SCANNING:
      return { ...state, isScanning: action.payload };
    case BluetoothActionType.SET_CONNECTED:
      return { ...state, isConnected: action.payload };
    case BluetoothActionType.SET_STREAMING:
      return { ...state, isStreaming: action.payload };
    case BluetoothActionType.ADD_DEVICE:
      return {
        ...state,
        devices: [...state.devices, action.payload],
        discoveredDevices: [...state.discoveredDevices, action.payload],
      };
    case BluetoothActionType.REMOVE_DEVICE:
      return {
        ...state,
        devices: state.devices.filter(device => device.id !== action.payload),
        discoveredDevices: state.discoveredDevices.filter(device => device.id !== action.payload),
      };
    case BluetoothActionType.SET_CONNECTED_DEVICE:
      return { ...state, connectedDevice: action.payload };
    case BluetoothActionType.SET_CONNECTION_DETAILS:
      return { ...state, connectionDetails: action.payload };
    case BluetoothActionType.SET_ERROR:
      return { ...state, error: action.payload };
    case BluetoothActionType.CLEAR_ERROR:
      return { ...state, error: null };
    case BluetoothActionType.SET_PENDING_COMMAND:
      return { ...state, pendingCommand: action.payload };
    default: {
      return state;
    }
  }
};

// Action Creators
export const bluetoothActions = {
  setInitialized: (isInitialized: boolean): SetInitializedAction => ({
    type: BluetoothActionType.SET_INITIALIZED,
    payload: isInitialized,
  }),

  setBluetoothOn: (isBluetoothOn: boolean): SetBluetoothOnAction => ({
    type: BluetoothActionType.SET_BLUETOOTH_ON,
    payload: isBluetoothOn,
  }),

  setPermissions: (hasPermissions: boolean): SetPermissionsAction => ({
    type: BluetoothActionType.SET_PERMISSIONS,
    payload: hasPermissions,
  }),

  setScanning: (isScanning: boolean): SetScanningAction => ({
    type: BluetoothActionType.SET_SCANNING,
    payload: isScanning,
  }),

  setConnected: (isConnected: boolean): SetConnectedAction => ({
    type: BluetoothActionType.SET_CONNECTED,
    payload: isConnected,
  }),

  setStreaming: (isStreaming: boolean): SetStreamingAction => ({
    type: BluetoothActionType.SET_STREAMING,
    payload: isStreaming,
  }),

  addDevice: (device: BluetoothDeviceInfo): AddDeviceAction => ({
    type: BluetoothActionType.ADD_DEVICE,
    payload: device,
  }),

  removeDevice: (deviceId: string): RemoveDeviceAction => ({
    type: BluetoothActionType.REMOVE_DEVICE,
    payload: deviceId,
  }),

  setConnectedDevice: (device: BluetoothDeviceInfo | null): SetConnectedDeviceAction => ({
    type: BluetoothActionType.SET_CONNECTED_DEVICE,
    payload: device,
  }),

  setConnectionDetails: (details: ConnectionDetails | null): SetConnectionDetailsAction => ({
    type: BluetoothActionType.SET_CONNECTION_DETAILS,
    payload: details,
  }),

  setError: (error: BluetoothOBDError): SetErrorAction => ({
    type: BluetoothActionType.SET_ERROR,
    payload: error,
  }),

  clearError: (): ClearErrorAction => ({
    type: BluetoothActionType.CLEAR_ERROR,
  }),

  setPendingCommand: (command: string | null): SetPendingCommandAction => ({
    type: BluetoothActionType.SET_PENDING_COMMAND,
    payload: command,
  }),
};
