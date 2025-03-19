import { BluetoothDeviceInfo, ConnectionDetails, BluetoothState } from '../types/bluetoothTypes';
import { BluetoothOBDError, BluetoothErrorType } from '../utils/errorUtils';

// Action Types
export const enum BluetoothActionType {
  SET_SCANNING = 'SET_SCANNING',
  SET_CONNECTED = 'SET_CONNECTED',
  SET_DEVICES = 'SET_DEVICES',
  ADD_DEVICE = 'ADD_DEVICE',
  REMOVE_DEVICE = 'REMOVE_DEVICE',
  SET_ERROR = 'SET_ERROR',
  CLEAR_ERROR = 'CLEAR_ERROR',
  SET_CONNECTION_DETAILS = 'SET_CONNECTION_DETAILS',
  RESET = 'RESET'
}

// Action Interfaces
export interface SetScanningAction {
  type: BluetoothActionType.SET_SCANNING;
  payload: boolean;
}

export interface SetConnectedAction {
  type: BluetoothActionType.SET_CONNECTED;
  payload: boolean;
}

export interface SetDevicesAction {
  type: BluetoothActionType.SET_DEVICES;
  payload: BluetoothDeviceInfo[];
}

export interface AddDeviceAction {
  type: BluetoothActionType.ADD_DEVICE;
  payload: BluetoothDeviceInfo;
}

export interface RemoveDeviceAction {
  type: BluetoothActionType.REMOVE_DEVICE;
  payload: string; // device id
}

export interface SetErrorAction {
  type: BluetoothActionType.SET_ERROR;
  payload: BluetoothOBDError;
}

export interface ClearErrorAction {
  type: BluetoothActionType.CLEAR_ERROR;
}

export interface SetConnectionDetailsAction {
  type: BluetoothActionType.SET_CONNECTION_DETAILS;
  payload: ConnectionDetails | null;
}

export interface ResetAction {
  type: BluetoothActionType.RESET;
}

export type BluetoothAction =
  | SetScanningAction
  | SetConnectedAction
  | SetDevicesAction
  | AddDeviceAction
  | RemoveDeviceAction
  | SetErrorAction
  | ClearErrorAction
  | SetConnectionDetailsAction
  | ResetAction;

// Initial State
export const initialState: BluetoothState = {
  isScanning: false,
  isConnected: false,
  devices: [],
  error: null,
  connectionDetails: null
};

// Reducer
export const bluetoothReducer = (
  state: BluetoothState,
  action: BluetoothAction
): BluetoothState => {
  switch (action.type) {
    case BluetoothActionType.SET_SCANNING:
      return {
        ...state,
        isScanning: action.payload
      };

    case BluetoothActionType.SET_CONNECTED:
      return {
        ...state,
        isConnected: action.payload,
        // Clear connection details if disconnected
        connectionDetails: action.payload ? state.connectionDetails : null
      };

    case BluetoothActionType.SET_DEVICES:
      return {
        ...state,
        devices: action.payload
      };

    case BluetoothActionType.ADD_DEVICE: {
      // Don't add if device already exists
      const existingDevice = state.devices.find(device => device.id === action.payload.id);
      if (existingDevice) {
        return state;
      }
      return {
        ...state,
        devices: [...state.devices, action.payload]
      };
    }

    case BluetoothActionType.REMOVE_DEVICE:
      return {
        ...state,
        devices: state.devices.filter(device => device.id !== action.payload)
      };

    case BluetoothActionType.SET_ERROR:
      return {
        ...state,
        error: action.payload
      };

    case BluetoothActionType.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case BluetoothActionType.SET_CONNECTION_DETAILS:
      return {
        ...state,
        connectionDetails: action.payload
      };

    case BluetoothActionType.RESET:
      return initialState;

    default:
      const _exhaustiveCheck: never = action;
      return state;
  }
};

// Action Creators
export const bluetoothActions = {
  setScanning: (isScanning: boolean): SetScanningAction => ({
    type: BluetoothActionType.SET_SCANNING,
    payload: isScanning
  }),

  setConnected: (isConnected: boolean): SetConnectedAction => ({
    type: BluetoothActionType.SET_CONNECTED,
    payload: isConnected
  }),

  setDevices: (devices: BluetoothDeviceInfo[]): SetDevicesAction => ({
    type: BluetoothActionType.SET_DEVICES,
    payload: devices
  }),

  addDevice: (device: BluetoothDeviceInfo): AddDeviceAction => ({
    type: BluetoothActionType.ADD_DEVICE,
    payload: device
  }),

  removeDevice: (deviceId: string): RemoveDeviceAction => ({
    type: BluetoothActionType.REMOVE_DEVICE,
    payload: deviceId
  }),

  setError: (error: BluetoothOBDError): SetErrorAction => ({
    type: BluetoothActionType.SET_ERROR,
    payload: error
  }),

  clearError: (): ClearErrorAction => ({
    type: BluetoothActionType.CLEAR_ERROR
  }),

  setConnectionDetails: (details: ConnectionDetails | null): SetConnectionDetailsAction => ({
    type: BluetoothActionType.SET_CONNECTION_DETAILS,
    payload: details
  }),

  reset: (): ResetAction => ({
    type: BluetoothActionType.RESET
  })
};
