/**
 * ⚠️ IMPORTANT: This library requires proper setup of the following dependencies:
 * - react-native-ble-manager
 * - react-native-permissions
 * - Bluetooth permissions in iOS/Android
 *
 * Please ensure you have these configured in your React Native project before using this library.
 */

// Core context and hooks
export { BluetoothProvider, useBluetooth } from './context/BluetoothContext';
export { useOBDManager } from './hooks/useOBDManager';
export { useDeviceDetection } from './hooks/useDeviceDetection';
export { useECUCommands } from './hooks/useECUCommands';

// Example components
export { OBDDeviceScanner } from './examples/OBDDeviceScanner';
export { OBDLiveData } from './examples/OBDLiveData';
export { OBDTerminal } from './examples/OBDTerminal';

// Types
export type { ConnectionDetails, BluetoothState } from './types/bluetoothTypes';
export { BluetoothActionType } from './types/bluetoothTypes';

// Managers
export { default as OBDManager } from './managers/OBDManager';
export { default as DeviceManager } from './managers/DeviceManager';
export { ConnectionState, OBDEventType, OBDProtocol } from './managers/OBDManager';

// Utilities
export { ELM_COMMANDS, STANDARD_PIDS } from './utils/obdUtils';
export { findServiceAndCharacteristic } from './utils/deviceUtils';
export { decodeData, encodeCommand, isResponseComplete, formatResponse } from './utils/dataUtils';
export { logBluetoothError, BluetoothErrorType } from './utils/errorUtils';
export { requestBluetoothPermissions, checkBluetoothState } from './utils/permissionUtils';

// Export the BluetoothProvider as default for convenience
export { BluetoothProvider as default };
