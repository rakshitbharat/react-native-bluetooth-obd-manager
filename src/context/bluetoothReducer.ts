import { BluetoothState, BluetoothActionType } from '../types/bluetoothTypes';

export const initialState: BluetoothState = {
  isInitialized: false,
  isBluetoothOn: false,
  hasPermissions: false,
  isScanning: false,
  discoveredDevices: [],
  connectedDevice: null,
  connectionDetails: null,
  isStreaming: false,
  pendingCommand: null,
  responseData: null,
  error: null,
};

export const bluetoothReducer = (
  state: BluetoothState,
  action: { type: BluetoothActionType; payload?: any },
): BluetoothState => {
  switch (action.type) {
    case BluetoothActionType.INITIALIZE_SUCCESS:
      return {
        ...state,
        isInitialized: true,
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
      // Prevent duplicate devices
      const exists = state.discoveredDevices.some(device => device.id === action.payload.id);

      return {
        ...state,
        discoveredDevices: exists
          ? state.discoveredDevices
          : [...state.discoveredDevices, action.payload],
      };

    case BluetoothActionType.CONNECT_START:
      return {
        ...state,
        error: null,
      };

    case BluetoothActionType.CONNECT_SUCCESS:
      return {
        ...state,
        connectedDevice: action.payload.device,
        connectionDetails: action.payload.details,
        error: null,
      };

    case BluetoothActionType.CONNECT_FAILURE:
      return {
        ...state,
        error: action.payload,
        connectedDevice: null,
        connectionDetails: null,
      };

    case BluetoothActionType.DISCONNECT_SUCCESS:
      return {
        ...state,
        connectedDevice: null,
        connectionDetails: null,
        isStreaming: false,
        error: null,
      };

    case BluetoothActionType.SEND_COMMAND:
      return {
        ...state,
        isStreaming: true,
        pendingCommand: action.payload,
      };

    case BluetoothActionType.RECEIVE_DATA:
      return {
        ...state,
        responseData: action.payload,
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
