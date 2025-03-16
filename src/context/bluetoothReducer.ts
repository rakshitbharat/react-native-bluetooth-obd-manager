import { BluetoothState, BluetoothAction, BluetoothActionType } from '../types/bluetoothTypes';
import { Peripheral } from 'react-native-ble-manager';

export const initialState: BluetoothState = {
  isInitialized: false,
  isBluetoothOn: false,
  hasPermissions: false,
  isScanning: false,
  discoveredDevices: [],
  connectedDevice: null,
  connectionDetails: null,
  isConnecting: false,
  isStreaming: false,
  pendingCommand: null,
  responseData: '',
  error: null,
};

export const bluetoothReducer = (
  state: BluetoothState,
  action: BluetoothAction
): BluetoothState => {
  switch (action.type) {
    case BluetoothActionType.INITIALIZE_SUCCESS:
      return {
        ...state,
        isInitialized: true,
        error: null,
      };
      
    case BluetoothActionType.INITIALIZE_FAILURE:
      return {
        ...state,
        isInitialized: false,
        error: 'Failed to initialize Bluetooth',
      };
      
    case BluetoothActionType.UPDATE_BLUETOOTH_STATE:
      return {
        ...state,
        isBluetoothOn: action.payload,
      };
      
    case BluetoothActionType.UPDATE_PERMISSIONS:
      return {
        ...state,
        hasPermissions: action.payload,
      };
      
    case BluetoothActionType.SCAN_START:
      return {
        ...state,
        isScanning: true,
        discoveredDevices: [],
        error: null,
      };
      
    case BluetoothActionType.SCAN_STOP:
      return {
        ...state,
        isScanning: false,
      };
      
    case BluetoothActionType.DEVICE_DISCOVERED:
      // Avoid duplicates
      const existingDeviceIndex = state.discoveredDevices.findIndex(
        device => device.id === action.payload.id
      );
      
      if (existingDeviceIndex >= 0) {
        const updatedDevices = [...state.discoveredDevices];
        updatedDevices[existingDeviceIndex] = action.payload;
        return {
          ...state,
          discoveredDevices: updatedDevices,
        };
      } else {
        return {
          ...state,
          discoveredDevices: [...state.discoveredDevices, action.payload],
        };
      }
      
    case BluetoothActionType.CONNECT_START:
      return {
        ...state,
        isConnecting: true,
        error: null,
      };
      
    case BluetoothActionType.CONNECT_SUCCESS:
      return {
        ...state,
        isConnecting: false,
        connectedDevice: action.payload.device,
        connectionDetails: action.payload.details,
        error: null,
      };
      
    case BluetoothActionType.CONNECT_FAILURE:
      return {
        ...state,
        isConnecting: false,
        error: action.payload || 'Connection failed',
      };
      
    case BluetoothActionType.DISCONNECT_SUCCESS:
      return {
        ...state,
        connectedDevice: null,
        connectionDetails: null,
        isStreaming: false,
        pendingCommand: null,
        responseData: '',
      };
      
    case BluetoothActionType.SEND_COMMAND:
      return {
        ...state,
        isStreaming: true,
        pendingCommand: action.payload,
        responseData: '',
        error: null,
      };
      
    case BluetoothActionType.RECEIVE_DATA:
      return {
        ...state,
        responseData: state.responseData + action.payload,
      };
      
    case BluetoothActionType.COMPLETE_COMMAND:
      return {
        ...state,
        isStreaming: false,
        pendingCommand: null,
      };
      
    case BluetoothActionType.RESET_STREAM:
      return {
        ...state,
        isStreaming: false,
        pendingCommand: null,
      };
      
    case BluetoothActionType.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };
      
    default:
      return state;
  }
};
