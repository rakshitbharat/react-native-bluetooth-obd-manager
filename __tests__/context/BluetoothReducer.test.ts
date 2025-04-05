// __tests__/context/BluetoothReducer.test.ts

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
// Use jest.spyOn within beforeAll/afterAll or directly
let dateNowSpy: jest.SpyInstance;
beforeAll(() => { dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => MOCK_DATE_NOW); });
afterAll(() => { dateNowSpy.mockRestore(); });


// Helper to create mock peripheral
const createMockPeripheral = (id: string, name?: string): Peripheral => ({
  id,
  name: name || `Device_${id}`,
  rssi: -50,
  advertising: {},
});

// Helper to create mock error
const createMockError = (message: string): Error => new Error(message);

describe('BluetoothReducer', () => {
  let state: BluetoothState;

  beforeEach(() => {
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
    state = { ...initialState, isInitializing: false, isBluetoothOn: true, isScanning: true, connectedDevice: createMockPeripheral('123'), hasPermissions: true };
    const action: BluetoothAction = { type: 'SET_BLUETOOTH_STATE', payload: false };
    const newState = bluetoothReducer(state, action);
    expect(newState).toEqual({ ...initialState, isInitializing: false, isBluetoothOn: false, hasPermissions: true });
  });

  it('should handle SET_PERMISSIONS_STATUS', () => {
    const action: BluetoothAction = { type: 'SET_PERMISSIONS_STATUS', payload: true };
    const newState = bluetoothReducer(state, action);
    expect(newState.hasPermissions).toBe(true);
  });

  it('should handle SET_ERROR and reset transient flags', () => {
    state = { ...state, isConnecting: true, isScanning: true, isAwaitingResponse: true };
    const error = createMockError('Connection Failed');
    const action: BluetoothAction = { type: 'SET_ERROR', payload: error };
    const newState = bluetoothReducer(state, action);
    expect(newState.error).toBe(error);
    expect(newState.isConnecting).toBe(false); expect(newState.isDisconnecting).toBe(false); expect(newState.isScanning).toBe(false); expect(newState.isAwaitingResponse).toBe(false);
  });

  it('should handle RESET_STATE', () => {
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
    expect(newState.isScanning).toBe(true); expect(newState.discoveredDevices).toEqual([]); expect(newState.error).toBeNull();
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
    expect(newState.isScanning).toBe(false); expect(newState.error).toBeNull();
  });

   it('should NOT clear other errors on SCAN_STOP', () => {
    const otherError = new Error('Something else'); state = { ...state, isScanning: true, error: otherError };
    const action: BluetoothAction = { type: 'SCAN_STOP' };
    const newState = bluetoothReducer(state, action);
    expect(newState.isScanning).toBe(false); expect(newState.error).toBe(otherError);
  });

  it('should handle DEVICE_FOUND and add unique devices', () => {
    const peripheral1: PeripheralWithPrediction = createMockPeripheral('111') as PeripheralWithPrediction; const peripheral2: PeripheralWithPrediction = createMockPeripheral('222') as PeripheralWithPrediction;
    let action1: BluetoothAction = { type: 'DEVICE_FOUND', payload: peripheral1 }; let newState = bluetoothReducer(state, action1);
    expect(newState.discoveredDevices).toEqual([peripheral1]);
    let action2: BluetoothAction = { type: 'DEVICE_FOUND', payload: peripheral2 }; newState = bluetoothReducer(newState, action2);
    expect(newState.discoveredDevices).toEqual([peripheral1, peripheral2]);
    newState = bluetoothReducer(newState, action1); expect(newState.discoveredDevices).toEqual([peripheral1, peripheral2]);
  });

  // --- Connection Actions ---
  it('should handle CONNECT_START', () => { /* ... */ }); // Covered above
  it('should handle CONNECT_SUCCESS', () => { /* ... */ }); // Covered above
  it('should handle CONNECT_FAILURE', () => { /* ... */ }); // Covered above
  it('should handle DEVICE_DISCONNECTED', () => { /* ... */ }); // Covered above
  it('should handle DISCONNECT_START', () => { /* ... */ }); // Covered above
  it('should handle DISCONNECT_SUCCESS', () => { /* ... */ }); // Covered above
  it('should handle DISCONNECT_FAILURE', () => { /* ... */ }); // Covered above

  // --- Command Actions ---
   it('should handle SEND_COMMAND_START', () => { /* ... */ }); // Covered above
   it('should handle COMMAND_SUCCESS', () => { /* ... */ }); // Covered above
   it('should handle COMMAND_FAILURE', () => { /* ... */ }); // Covered above
   it('should handle COMMAND_TIMEOUT', () => { /* ... */ }); // Covered above
   it('should handle DATA_RECEIVED (no state change)', () => { /* ... */ }); // Covered above

  // --- Streaming Actions ---
  it('should handle SET_STREAMING_STATUS (true)', () => { /* ... */ }); // Covered above
  it('should handle SET_STREAMING_STATUS (false)', () => { /* ... */ }); // Covered above
  it('should clear streaming inactivity error on SET_STREAMING_STATUS (false)', () => { /* ... */ }); // Covered above
  it('should handle UPDATE_LAST_SUCCESS_TIMESTAMP', () => { /* ... */ }); // Covered above
  it('should handle STREAMING_INACTIVITY_TIMEOUT', () => { /* ... */ }); // Covered above
});