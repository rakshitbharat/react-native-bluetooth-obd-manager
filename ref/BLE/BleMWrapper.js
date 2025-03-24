import BleManager, {
  BleScanCallbackType,
  BleScanMatchMode,
  BleScanMode,
  BleState,
  BleStatus,
} from 'react-native-ble-manager';
import { NativeEventEmitter, NativeModules } from 'react-native';

// Event types
export const BleManagerDidUpdateValueForCharacteristicEvent = 'BleManagerDidUpdateValueForCharacteristic';
export const BleManagerDidUpdateStateEvent = 'BleManagerDidUpdateState';
export const BleDisconnectPeripheralEvent = 'BleManagerDisconnectPeripheral';
export const BleManagerDidUpdateNotificationStateForCharacteristicEvent = 'BleManagerDidUpdateNotificationStateForCharacteristic';
export const BleStopScanEvent = 'BleManagerStopScan';
export const BleDiscoverPeripheralEvent = 'BleManagerDiscoverPeripheral';
export const BleConnectPeripheralEvent = 'BleManagerConnectPeripheral';

// Create event emitter
export const BleManagerEmitter = new NativeEventEmitter(NativeModules.BleManager);

// Re-export types
export {
  BleScanCallbackType,
  BleScanMatchMode,
  BleScanMode,
  BleState,
  BleStatus,
};

// Export BleManager as default
export default BleManager;
