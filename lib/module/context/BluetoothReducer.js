// src/context/BluetoothReducer.ts

/**
 * The initial state for the Bluetooth context.
 */
export const initialState = {
  // Core BLE State
  isBluetoothOn: false,
  hasPermissions: false,
  // Assume no permissions initially
  isInitializing: true,
  // Start in initializing state until BleManager is ready
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
  // Initialize streaming as off
  lastSuccessfulCommandTimestamp: null
};

/**
 * Reducer function to manage Bluetooth state transitions.
 * @param state - The current state.
 * @param action - The action dispatched to update the state.
 * @returns The new state.
 */
export function bluetoothReducer(state, action) {
  switch (action.type) {
    // --- Initialization & State ---
    case 'SET_INITIALIZING':
      return {
        ...state,
        isInitializing: action.payload
      };
    case 'SET_BLUETOOTH_STATE':
      {
        if (!action.payload) {
          return {
            ...initialState,
            isInitializing: false,
            isBluetoothOn: false,
            hasPermissions: state.hasPermissions // Preserve permission status
          };
        }
        return {
          ...state,
          isBluetoothOn: action.payload
        };
      }
    case 'SET_PERMISSIONS_STATUS':
      return {
        ...state,
        hasPermissions: action.payload
      };
    case 'SET_ERROR':
      {
        return {
          ...state,
          error: action.payload,
          // Reset all transient flags
          isConnecting: false,
          isDisconnecting: false,
          isScanning: false,
          isAwaitingResponse: false
        };
      }
    case 'RESET_STATE':
      return {
        ...initialState
      };

    // --- Scanning Actions ---
    case 'SCAN_START':
      return {
        ...state,
        isScanning: true,
        discoveredDevices: [],
        // Clear previous results
        error: null // Clear previous errors
      };
    case 'SCAN_STOP':
      {
        var _state$error;
        const isTimeoutError = (_state$error = state.error) === null || _state$error === void 0 || (_state$error = _state$error.message) === null || _state$error === void 0 ? void 0 : _state$error.includes('Scan timed out');
        return {
          ...state,
          isScanning: false,
          error: isTimeoutError ? null : state.error // Clear only timeout errors
        };
      }
    case 'DEVICE_FOUND':
      {
        // Remove existing device with same ID
        const existingDevices = state.discoveredDevices.filter(device => device.id !== action.payload.id);

        // Add new device and sort by ID to maintain consistent order
        const newDevices = [...existingDevices, action.payload].sort((a, b) => a.id.localeCompare(b.id));
        return {
          ...state,
          discoveredDevices: newDevices
        };
      }
    case 'CLEAR_DISCOVERED_DEVICES':
      return {
        ...state,
        discoveredDevices: []
      };

    // --- Connection Actions ---
    case 'CONNECT_START':
      return {
        ...state,
        isConnecting: true,
        error: null
      };
    case 'CONNECT_SUCCESS':
      return {
        ...state,
        isConnecting: false,
        connectedDevice: action.payload.device,
        activeDeviceConfig: action.payload.config,
        error: null
      };
    case 'CONNECT_FAILURE':
      return {
        ...state,
        isConnecting: false,
        connectedDevice: null,
        activeDeviceConfig: null,
        error: action.payload
      };
    case 'DEVICE_DISCONNECTED':
      {
        return {
          ...state,
          connectedDevice: null,
          activeDeviceConfig: null,
          isConnecting: false,
          isDisconnecting: false,
          isAwaitingResponse: false,
          isStreaming: false,
          lastSuccessfulCommandTimestamp: null
        };
      }
    case 'DISCONNECT_START':
      return {
        ...state,
        isDisconnecting: true
      };
    case 'DISCONNECT_SUCCESS':
      return {
        ...state,
        isDisconnecting: false,
        connectedDevice: null,
        activeDeviceConfig: null
      };
    case 'DISCONNECT_FAILURE':
      return {
        ...state,
        isDisconnecting: false,
        error: action.payload
      };

    // --- Command Actions ---
    case 'SEND_COMMAND_START':
      return {
        ...state,
        isAwaitingResponse: true,
        error: null
      };
    case 'COMMAND_SUCCESS':
      return {
        ...state,
        isAwaitingResponse: false,
        error: null,
        lastSuccessfulCommandTimestamp: Date.now()
      };
    case 'COMMAND_FAILURE':
      return {
        ...state,
        isAwaitingResponse: false,
        error: action.payload
      };
    case 'COMMAND_TIMEOUT':
      return {
        ...state,
        isAwaitingResponse: false,
        error: new Error('Command timed out waiting for response.')
      };
    case 'DATA_RECEIVED':
      return state;
    // No state change directly from receiving raw data chunk here

    // --- Streaming Actions ---
    case 'SET_STREAMING_STATUS':
      {
        var _state$error2;
        // Use console.info instead of console.log
        console.info(`[Reducer] Setting isStreaming=${action.payload}`);
        return {
          ...state,
          isStreaming: action.payload,
          lastSuccessfulCommandTimestamp: action.payload ? Date.now() : null,
          error: !action.payload && (_state$error2 = state.error) !== null && _state$error2 !== void 0 && (_state$error2 = _state$error2.message) !== null && _state$error2 !== void 0 && _state$error2.includes('Streaming stopped') ? null : state.error
        };
      }
    case 'UPDATE_LAST_SUCCESS_TIMESTAMP':
      return {
        ...state,
        lastSuccessfulCommandTimestamp: Date.now()
      };
    case 'STREAMING_INACTIVITY_TIMEOUT':
      console.warn('[Reducer] Streaming inactivity timeout detected.');
      return {
        ...state,
        isStreaming: false,
        lastSuccessfulCommandTimestamp: null,
        error: new Error('Streaming stopped due to inactivity.')
      };
    default:
      {
        const unknownAction = action;
        console.warn(`[BluetoothReducer] Unhandled action type: ${unknownAction.type}`);
        return state;
      }
  }
}
//# sourceMappingURL=BluetoothReducer.js.map