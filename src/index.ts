// Main entry point for React Native Bluetooth OBD Manager
import BluetoothProvider from './context/BluetoothContext';
export { useBluetooth } from './context/BluetoothContext';
export { BluetoothProvider };
export { useOBDManager } from './hooks/useOBDManager';
export { useDeviceDetection } from './hooks/useDeviceDetection';
export { useECUCommands } from './hooks/useECUCommands';
export { useOBDMonitoring } from './hooks/useOBDMonitoring';

// Export components
export { OBDLiveData } from './examples/OBDLiveData';
export { OBDDeviceScanner } from './examples/OBDDeviceScanner';
export { OBDTerminal } from './examples/OBDTerminal';
export { MinimalOBDExample } from './examples/MinimalOBDExample';

// Export utilities
export * from './utils/obdUtils';
export * from './utils/errorUtils';
export * from './types/bluetoothTypes';

// Export device compatibility utilities
export { default as DeviceCompatibilityManager } from './utils/deviceCompatibility';
export { isOBDDevice, getCommonELM327Profile } from './utils/deviceCompatibility';

// Export ECU connector
export { ECUConnector, BluetoothECUConnector, createECUConnector } from './connectors/ECUConnector';

/**
 * React Native Bluetooth OBD Manager
 *
 * A comprehensive library for connecting to ELM327-based OBD-II adapters via Bluetooth in React Native apps.
 *
 * Features:
 * - Scan and connect to Bluetooth OBD-II adapters
 * - Automatic service and characteristic detection
 * - Simplified OBD command interface
 * - Built-in support for common OBD-II PIDs
 * - Read vehicle data (RPM, speed, temperature, etc.)
 * - Read and clear diagnostic trouble codes
 * - Device memory to reconnect to previous devices
 *
 * Usage:
 * 1. Wrap your app with the BluetoothProvider
 * 2. Use the useOBDManager hook to interact with OBD devices
 * 3. Use the provided components for quick implementation
 *
 * Example:
 * ```jsx
 * import { BluetoothProvider, useOBDManager, OBDLiveData } from 'react-native-bluetooth-obd-manager';
 *
 * const App = () => {
 *   return (
 *     <BluetoothProvider>
 *       <OBDLiveData />
 *     </BluetoothProvider>
 *   );
 * };
 * ```
 */
