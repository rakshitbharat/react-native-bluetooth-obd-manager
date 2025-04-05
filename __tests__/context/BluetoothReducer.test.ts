import {
  bluetoothReducer,
  initialState,
} from '../../src/context/BluetoothReducer';
import type {
  BluetoothState,
  BluetoothAction,
  PeripheralWithPrediction,
  ActiveDeviceConfig,
} from '../../src/types';
import type { BleError, Peripheral } from 'react-native-ble-manager'; // For typing mock errors/peripherals

// Mock Date.now() for consistent timestamp testing
const MOCK_DATE_NOW = 1678886400000; // Example timestamp: March 15, 2023 12:00:00 PM UTC
jest.spyOn(Date, 'now').mockImplementation(() => MOCK_DATE_NOW);

// Helper to create mock peripheral
const createMockPeripheral = (id: string, name?: string): Peripheral => ({
  id,
  name: name || `Device_${id}`,
  rssi: -50,
  advertising: {},
  // services and characteristics might be added if needed for specific state tests
});

// Helper to create mock error
const createMockError = (message: string): Error => {
  return {
    name: 'Error',
    message,
    toString: () => `Error: ${message}`
  } as Error;
};

describe('BluetoothReducer', () => {
  let state: BluetoothState;

  beforeEach(() => {
    // Reset state before each test
    state = { ...initialState }; // Create a fresh copy
  });

  it('should return the initial state for unknown actions', () => {
    const unknownAction = { type: 'UNKNOWN_ACTION' } as any;
    expect(bluetoothReducer(state, unknownAction)).toEqual(initialState);
  });

  // --- Initialization & State ---
  it('should handle SET_INITIALIZING', () => {
    const action: BluetoothAction = { type: 'SET_INITIALIZING', payload: false };
    const newState = bluetoothReducer(state, action);
    expect(newState.isInitializing).toBe(false);
  });

  it('should handle SET_BLUETOOTH_STATE (true)', () => {
    const action: BluetoothAction = { type: 'SET_BLUETOOTH_STATE', payload: true };
    const newState = bluetoothReducer(state, action);
    expect(newState.isBluetoothOn).toBe(true);
  });

  it('should handle SET_BLUETOOTH_STATE (false) and reset state', () => {
    // Set some state first
    state = {
      ...initialState,
      isInitializing: false,
      isBluetoothOn: true,
      isScanning: true,
      connectedDevice: createMockPeripheral('123'),
      hasPermissions: true, // Keep permissions
    };
    const action: BluetoothAction = { type: 'SET_BLUETOOTH_STATE', payload: false };
    const newState = bluetoothReducer(state, action);
    // Check that most state is reset, but permissions and init status are preserved
    expect(newState).toEqual({
      ...initialState,
      isInitializing: false,
      isBluetoothOn: false,
      hasPermissions: true, // Permissions should persist
    });
  });

  it('should handle SET_PERMISSIONS_STATUS', () => {
    const action: BluetoothAction = { type: 'SET_PERMISSIONS_STATUS', payload: true };
    const newState = bluetoothReducer(state, action);
    expect(newState.hasPermissions).toBe(true);
  });

  it('should handle SET_ERROR and reset transient flags', () => {
    state = {
      ...state,
      isConnecting: true,
      isScanning: true,
      isAwaitingResponse: true,
    };
    const error = createMockError('Connection Failed');
    const action: BluetoothAction = { type: 'SET_ERROR', payload: error };
    const newState = bluetoothReducer(state, action);
    expect(newState.error).toBe(error);
    expect(newState.isConnecting).toBe(false);
    expect(newState.isDisconnecting).toBe(false);
    expect(newState.isScanning).toBe(false);
    expect(newState.isAwaitingResponse).toBe(false);
  });

  it('should handle RESET_STATE', () => {
    // Modify state
    state = { ...state, isScanning: true, error: createMockError('Some error') };
    const action: BluetoothAction = { type: 'RESET_STATE' };
    const newState = bluetoothReducer(state, action);
    expect(newState).toEqual(initialState);
  });

  // --- Scanning Actions ---
  it('should handle SCAN_START', () => {
    state = { ...state, discoveredDevices: [createMockPeripheral('old') as PeripheralWithPrediction], error: createMockError("prev error") };
    const action: BluetoothAction = { type: 'SCAN_START' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isScanning).toBe(true);
    expect(newState.discoveredDevices).toEqual([]);
    expect(newState.error).toBeNull();
  });

  it('should handle SCAN_STOP', () => {
    state = { ...state, isScanning: true };
    const action: BluetoothAction = { type: 'SCAN_STOP' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isScanning).toBe(false);
  });

   it('should clear scan timeout error on SCAN_STOP', () => {
    state = { ...state, isScanning: true, error: new Error('Scan timed out') };
    const action: BluetoothAction = { type: 'SCAN_STOP' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isScanning).toBe(false);
    expect(newState.error).toBeNull(); // Error should be cleared
  });

   it('should NOT clear other errors on SCAN_STOP', () => {
    const otherError = new Error('Something else');
    state = { ...state, isScanning: true, error: otherError };
    const action: BluetoothAction = { type: 'SCAN_STOP' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isScanning).toBe(false);
    expect(newState.error).toBe(otherError); // Error should persist
  });

  it('should handle DEVICE_FOUND and add unique devices', () => {
    const peripheral1: PeripheralWithPrediction = createMockPeripheral('111') as PeripheralWithPrediction;
    const peripheral2: PeripheralWithPrediction = createMockPeripheral('222') as PeripheralWithPrediction;

    // Add first device
    let action1: BluetoothAction = { type: 'DEVICE_FOUND', payload: peripheral1 };
    let newState = bluetoothReducer(state, action1);
    expect(newState.discoveredDevices).toEqual([peripheral1]);

    // Add second device
    let action2: BluetoothAction = { type: 'DEVICE_FOUND', payload: peripheral2 };
    newState = bluetoothReducer(newState, action2);
    expect(newState.discoveredDevices).toEqual([peripheral1, peripheral2]);

    // Try adding first device again (should not change state)
    newState = bluetoothReducer(newState, action1);
    expect(newState.discoveredDevices).toEqual([peripheral1, peripheral2]);
  });

  // --- Connection Actions ---
  it('should handle CONNECT_START', () => {
    state = { ...state, error: createMockError('prev error') };
    const action: BluetoothAction = { type: 'CONNECT_START' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isConnecting).toBe(true);
    expect(newState.error).toBeNull();
  });

  it('should handle CONNECT_SUCCESS', () => {
    const device = createMockPeripheral('abc');
    const config: ActiveDeviceConfig = { serviceUUID: 's1', writeCharacteristicUUID: 'w1', notifyCharacteristicUUID: 'n1', writeType: 'Write' };
    state = { ...state, isConnecting: true };
    const action: BluetoothAction = { type: 'CONNECT_SUCCESS', payload: { device, config } };
    const newState = bluetoothReducer(state, action);
    expect(newState.isConnecting).toBe(false);
    expect(newState.connectedDevice).toBe(device);
    expect(newState.activeDeviceConfig).toBe(config);
    expect(newState.error).toBeNull();
  });

  it('should handle CONNECT_FAILURE', () => {
    const error = createMockError('Conn Fail');
    state = { ...state, isConnecting: true };
    const action: BluetoothAction = { type: 'CONNECT_FAILURE', payload: error };
    const newState = bluetoothReducer(state, action);
    expect(newState.isConnecting).toBe(false);
    expect(newState.connectedDevice).toBeNull();
    expect(newState.activeDeviceConfig).toBeNull();
    expect(newState.error).toBe(error);
  });

  it('should handle DEVICE_DISCONNECTED', () => {
    const device = createMockPeripheral('abc');
    const config: ActiveDeviceConfig = { serviceUUID: 's1', writeCharacteristicUUID: 'w1', notifyCharacteristicUUID: 'n1', writeType: 'Write' };
    state = {
        ...state,
        connectedDevice: device,
        activeDeviceConfig: config,
        isConnecting: false,
        isDisconnecting: false,
        isAwaitingResponse: true, // Should be reset
        isStreaming: true, // Should be reset
        lastSuccessfulCommandTimestamp: MOCK_DATE_NOW - 1000, // Should be reset
    };
    const action: BluetoothAction = { type: 'DEVICE_DISCONNECTED' };
    const newState = bluetoothReducer(state, action);
    expect(newState.connectedDevice).toBeNull();
    expect(newState.activeDeviceConfig).toBeNull();
    expect(newState.isConnecting).toBe(false);
    expect(newState.isDisconnecting).toBe(false);
    expect(newState.isAwaitingResponse).toBe(false);
    expect(newState.isStreaming).toBe(false);
    expect(newState.lastSuccessfulCommandTimestamp).toBeNull();
  });

  it('should handle DISCONNECT_START', () => {
    const action: BluetoothAction = { type: 'DISCONNECT_START' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isDisconnecting).toBe(true);
  });

  it('should handle DISCONNECT_SUCCESS', () => {
    state = { ...state, isDisconnecting: true };
    const action: BluetoothAction = { type: 'DISCONNECT_SUCCESS' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isDisconnecting).toBe(false);
  });

   it('should handle DISCONNECT_FAILURE', () => {
    const error = createMockError('Disconnect failed');
    state = { ...state, isDisconnecting: true };
    const action: BluetoothAction = { type: 'DISCONNECT_FAILURE', payload: error };
    const newState = bluetoothReducer(state, action);
    expect(newState.isDisconnecting).toBe(false);
    expect(newState.error).toBe(error);
  });

  // --- Command Actions ---
   it('should handle SEND_COMMAND_START', () => {
    state = { ...state, error: createMockError('prev error') };
    const action: BluetoothAction = { type: 'SEND_COMMAND_START' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isAwaitingResponse).toBe(true);
    expect(newState.error).toBeNull(); // Clears previous error
  });

   it('should handle COMMAND_SUCCESS', () => {
    state = { ...state, isAwaitingResponse: true, error: createMockError('prev error') };
    const action: BluetoothAction = { type: 'COMMAND_SUCCESS' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isAwaitingResponse).toBe(false);
    expect(newState.error).toBeNull(); // Clears previous error
    expect(newState.lastSuccessfulCommandTimestamp).toBe(MOCK_DATE_NOW); // Timestamp updated
  });

   it('should handle COMMAND_FAILURE', () => {
    const error = createMockError('Write failed');
    state = { ...state, isAwaitingResponse: true };
    const action: BluetoothAction = { type: 'COMMAND_FAILURE', payload: error };
    const newState = bluetoothReducer(state, action);
    expect(newState.isAwaitingResponse).toBe(false);
    expect(newState.error).toBe(error);
  });

   it('should handle COMMAND_TIMEOUT', () => {
    state = { ...state, isAwaitingResponse: true };
    const action: BluetoothAction = { type: 'COMMAND_TIMEOUT' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isAwaitingResponse).toBe(false);
    expect(newState.error).toBeInstanceOf(Error);
    expect(newState.error?.message).toContain('timed out');
  });

   it('should handle DATA_RECEIVED (no state change)', () => {
    const data = [65, 66, 67]; // ABC
    const action: BluetoothAction = { type: 'DATA_RECEIVED', payload: data };
    const newState = bluetoothReducer(state, action);
    // Expect state to be unchanged by just receiving data chunk
    expect(newState).toEqual(state);
  });

  // --- Streaming Actions ---
  it('should handle SET_STREAMING_STATUS (true)', () => {
    const action: BluetoothAction = { type: 'SET_STREAMING_STATUS', payload: true };
    const newState = bluetoothReducer(state, action);
    expect(newState.isStreaming).toBe(true);
    expect(newState.lastSuccessfulCommandTimestamp).toBe(MOCK_DATE_NOW); // Timestamp reset on start
  });

  it('should handle SET_STREAMING_STATUS (false)', () => {
    state = { ...state, isStreaming: true, lastSuccessfulCommandTimestamp: MOCK_DATE_NOW - 5000 };
    const action: BluetoothAction = { type: 'SET_STREAMING_STATUS', payload: false };
    const newState = bluetoothReducer(state, action);
    expect(newState.isStreaming).toBe(false);
    expect(newState.lastSuccessfulCommandTimestamp).toBeNull(); // Timestamp cleared on stop
  });

  it('should clear streaming inactivity error on SET_STREAMING_STATUS (false)', () => {
    state = { ...state, isStreaming: true, error: new Error('Streaming stopped due to inactivity.')};
    const action: BluetoothAction = { type: 'SET_STREAMING_STATUS', payload: false };
    const newState = bluetoothReducer(state, action);
    expect(newState.isStreaming).toBe(false);
    expect(newState.error).toBeNull(); // Error should be cleared
   });

   it('should handle UPDATE_LAST_SUCCESS_TIMESTAMP', () => {
     const action: BluetoothAction = { type: 'UPDATE_LAST_SUCCESS_TIMESTAMP' };
     const newState = bluetoothReducer(state, action);
     expect(newState.lastSuccessfulCommandTimestamp).toBe(MOCK_DATE_NOW);
   });

   it('should handle STREAMING_INACTIVITY_TIMEOUT', () => {
     state = { ...state, isStreaming: true, lastSuccessfulCommandTimestamp: MOCK_DATE_NOW - 5000, error: null };
     const action: BluetoothAction = { type: 'STREAMING_INACTIVITY_TIMEOUT' };
     const newState = bluetoothReducer(state, action);
     expect(newState.isStreaming).toBe(false);
     expect(newState.lastSuccessfulCommandTimestamp).toBeNull();
     expect(newState.error).toBeInstanceOf(Error);
     expect(newState.error?.message).toContain('Streaming stopped due to inactivity');
   });
});
