// src/context/BluetoothReducer.ts

import type { BluetoothState, BluetoothAction } from '../types';

/**
 * The initial state for the Bluetooth context.
 * All required fields must have non-null values.
 */
export const initialState: BluetoothState = {
  // Core BLE State
  isInitializing: true,
  isBluetoothOn: false,
  hasPermissions: false,
  error: null,

  // Scanning State
  isScanning: false,
  discoveredDevices: [],

  // Connection State
  isConnecting: false,
  isDisconnecting: false,
  connectedDevice: null,
  activeDeviceConfig: null,

  // Command State
  isAwaitingResponse: false,

  // Streaming State
  isStreaming: false,
  lastSuccessfulCommandTimestamp: null,
};

/**
 * Ensures that no required state fields are null
 */
function validateState(state: BluetoothState): BluetoothState {
  // Ensure arrays are never null
  if (!state.discoveredDevices) state.discoveredDevices = [];
  
  // Ensure boolean flags are never null
  state.isInitializing = !!state.isInitializing;
  state.isBluetoothOn = !!state.isBluetoothOn;
  state.hasPermissions = !!state.hasPermissions;
  state.isScanning = !!state.isScanning;
  state.isConnecting = !!state.isConnecting;
  state.isDisconnecting = !!state.isDisconnecting;
  state.isAwaitingResponse = !!state.isAwaitingResponse;
  state.isStreaming = !!state.isStreaming;

  return state;
}

/**
 * Reducer function to manage Bluetooth state transitions.
 * Ensures state is never null and all required fields are present.
 */
export function bluetoothReducer(
  state: BluetoothState = initialState,
  action: BluetoothAction,
): BluetoothState {
  let newState: BluetoothState;

  switch (action.type) {
    // --- Initialization & State ---
    case 'SET_INITIALIZING':
      newState = { ...state, isInitializing: action.payload };
      break;

    case 'SET_BLUETOOTH_STATE':
      if (!action.payload) {
        newState = {
          ...initialState,
          isInitializing: false,
          isBluetoothOn: false,
          hasPermissions: state.hasPermissions,
        };
      } else {
        newState = { ...state, isBluetoothOn: action.payload };
      }
      break;

    case 'SET_PERMISSIONS_STATUS':
      newState = { ...state, hasPermissions: action.payload };
      break;

    case 'SET_ERROR': {
      newState = {
        ...state,
        error: action.payload,
        // Reset all transient flags
        isConnecting: false,
        isDisconnecting: false,
        isScanning: false,
        isAwaitingResponse: false,
      };
      break;
    }

    case 'RESET_STATE':
      newState = { ...initialState };
      break;

    // --- Scanning Actions ---
    case 'SCAN_START':
      newState = {
        ...state,
        isScanning: true,
        discoveredDevices: [], // Clear previous results
        error: null, // Clear previous errors
      };
      break;

    case 'SCAN_STOP': {
      const isTimeoutError = state.error?.message?.includes('Scan timed out');
      newState = {
        ...state,
        isScanning: false,
        error: isTimeoutError ? null : state.error, // Clear only timeout errors
      };
      break;
    }

    case 'DEVICE_FOUND': {
      // Remove existing device with same ID
      const existingDevices = state.discoveredDevices.filter(
        device => device.id !== action.payload.id,
      );

      // Add new device and sort by ID to maintain consistent order
      const newDevices = [...existingDevices, action.payload].sort((a, b) =>
        a.id.localeCompare(b.id),
      );

      newState = {
        ...state,
        discoveredDevices: newDevices,
      };
      break;
    }

    case 'CLEAR_DISCOVERED_DEVICES':
      newState = { ...state, discoveredDevices: [] };
      break;

    // --- Connection Actions ---
    case 'CONNECT_START':
      newState = { ...state, isConnecting: true, error: null };
      break;

    case 'CONNECT_SUCCESS':
      newState = {
        ...state,
        isConnecting: false,
        connectedDevice: action.payload.device,
        activeDeviceConfig: action.payload.config,
        error: null,
      };
      break;

    case 'CONNECT_FAILURE':
      newState = {
        ...state,
        isConnecting: false,
        connectedDevice: null,
        activeDeviceConfig: null,
        error: action.payload,
      };
      break;

    case 'DEVICE_DISCONNECTED': {
      newState = {
        ...state,
        connectedDevice: null,
        activeDeviceConfig: null,
        isConnecting: false,
        isDisconnecting: false,
        isAwaitingResponse: false,
        isStreaming: false,
        lastSuccessfulCommandTimestamp: null,
      };
      break;
    }

    case 'DISCONNECT_START':
      newState = { ...state, isDisconnecting: true };
      break;

    case 'DISCONNECT_SUCCESS':
      newState = {
        ...state,
        isDisconnecting: false,
        connectedDevice: null,
        activeDeviceConfig: null,
      };
      break;

    case 'DISCONNECT_FAILURE':
      newState = { ...state, isDisconnecting: false, error: action.payload };
      break;

    // --- Command Actions ---
    case 'SEND_COMMAND_START':
      newState = { ...state, isAwaitingResponse: true, error: null };
      break;

    case 'COMMAND_SUCCESS':
      newState = {
        ...state,
        isAwaitingResponse: false,
        error: null,
        lastSuccessfulCommandTimestamp: Date.now(),
      };
      break;

    case 'COMMAND_FAILURE':
      newState = {
        ...state,
        isAwaitingResponse: false,
        error: action.payload,
      };
      break;

    case 'COMMAND_TIMEOUT':
      newState = {
        ...state,
        isAwaitingResponse: false,
        error: new Error('Command timed out waiting for response.'),
      };
      break;

    case 'DATA_RECEIVED':
      newState = state; // No state change directly from receiving raw data chunk here
      break;

    // --- Streaming Actions ---
    case 'SET_STREAMING_STATUS': {
      // Use console.info instead of console.log
      console.info(`[Reducer] Setting isStreaming=${action.payload}`);
      newState = {
        ...state,
        isStreaming: action.payload,
        lastSuccessfulCommandTimestamp: action.payload ? Date.now() : null,
        error:
          !action.payload && state.error?.message?.includes('Streaming stopped')
            ? null
            : state.error,
      };
      break;
    }

    case 'UPDATE_LAST_SUCCESS_TIMESTAMP':
      newState = { ...state, lastSuccessfulCommandTimestamp: Date.now() };
      break;

    case 'STREAMING_INACTIVITY_TIMEOUT':
      console.warn('[Reducer] Streaming inactivity timeout detected.');
      newState = {
        ...state,
        isStreaming: false,
        lastSuccessfulCommandTimestamp: null,
        error: new Error('Streaming stopped due to inactivity.'),
      };
      break;

    default: {
      const unknownAction = action as { type: string };
      console.warn(
        `[BluetoothReducer] Unhandled action type: ${unknownAction.type}`,
      );
      newState = state;
    }
  }

  // Ensure state is valid before returning
  return validateState(newState);
}
