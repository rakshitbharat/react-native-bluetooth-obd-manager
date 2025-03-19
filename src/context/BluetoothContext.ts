import { createContext } from 'react';

import { BluetoothState } from '../types/bluetoothTypes';

// Initialize with default values
const initialState: BluetoothState = {
  isInitialized: false,
  isBluetoothOn: false,
  hasPermissions: false,
  isScanning: false,
  isConnected: false,
  isStreaming: false,
  devices: [],
  discoveredDevices: [],
  connectedDevice: null,
  error: null,
  connectionDetails: null,
  pendingCommand: null,
};

// Create the context with initial state
const BluetoothContext = createContext<BluetoothState>(initialState);

// Export just the context, all implementation is in BluetoothContext.tsx
export { BluetoothContext };
export default BluetoothContext;
