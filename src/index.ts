// src/index.ts

/**
 * React Native Bluetooth OBD Manager
 * 
 * A React Native library for communicating with OBD-II adapters via Bluetooth Low Energy.
 * Provides a React hook API for scanning, connecting, and sending commands to ELM327 devices.
 * 
 * @packageDocumentation
 */

/**
 * Provider component that must wrap your application to use the useBluetooth hook.
 * Manages Bluetooth state and event listeners.
 */
export { BluetoothProvider } from './context/BluetoothProvider';

/**
 * Main hook for interacting with Bluetooth OBD-II adapters.
 * Provides all functions needed to scan for, connect to, and communicate with OBD devices.
 */
export { useBluetooth } from './hooks/useBluetooth';

// Export relevant types for users of the library
export type {
  UseBluetoothResult,
  ActiveDeviceConfig,
  PeripheralWithPrediction,
  BluetoothState,
  BleError,
} from './types';

// Export Peripheral from react-native-ble-manager for convenience
export type { Peripheral } from './types;