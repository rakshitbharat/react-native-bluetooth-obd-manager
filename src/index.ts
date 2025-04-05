// src/index.ts

// Export the Provider component
export { BluetoothProvider } from './context/BluetoothProvider';

// Export the main hook
export { useBluetooth } from './hooks/useBluetooth';

// Export relevant types for users of the library
export type {
  UseBluetoothResult,
  ActiveDeviceConfig,
  PeripheralWithPrediction,
  BluetoothState, // Exporting state type can be useful for consumers
  BleError,
} from './types';

// Optionally export Peripheral from react-native-ble-manager if needed often by consumers
// Re-exporting can be convenient so users only import from your library
export type { Peripheral } from './types';