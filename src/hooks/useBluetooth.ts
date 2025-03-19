import { useContext } from 'react';

import { BluetoothContext } from '../context/BluetoothContext';
import { BluetoothContextValue, BluetoothState } from '../types/bluetoothTypes';
import { BluetoothOBDError, BluetoothErrorType } from '../utils/errorUtils';

/**
 * Custom hook for accessing the BluetoothContext
 * This provides properly typed access to the Bluetooth functionality
 */
const useBluetooth = (): BluetoothContextValue => {
  // Get the context
  const bluetoothState = useContext(BluetoothContext);

  // Check if context is available (will occur if used outside provider)
  if (!bluetoothState) {
    throw new BluetoothOBDError(
      BluetoothErrorType.UNKNOWN_ERROR,
      'useBluetooth must be used within a BluetoothProvider',
    );
  }

  // Since we're in a hook, we're just accessing state
  // The actual implementation of these methods is in the BluetoothProvider component
  // We're returning a stub implementation for this example
  return {
    // State properties
    ...bluetoothState,

    // Method implementations would be provided by the actual Provider
    initialize: async () => {
      console.warn('Method not implemented: initialize');
      return false;
    },
    requestPermissions: async () => {
      console.warn('Method not implemented: requestPermissions');
      return false;
    },
    scanDevices: async () => {
      console.warn('Method not implemented: scanDevices');
      return false;
    },
    connectToDevice: async () => {
      console.warn('Method not implemented: connectToDevice');
      return false;
    },
    disconnect: async () => {
      console.warn('Method not implemented: disconnect');
      return false;
    },
    sendCommand: async () => {
      console.warn('Method not implemented: sendCommand');
      return '';
    },
    reconnectToLastDevice: async () => {
      console.warn('Method not implemented: reconnectToLastDevice');
      return false;
    },
    getRecentDevices: () => {
      console.warn('Method not implemented: getRecentDevices');
      return [];
    },
  };
};

export default useBluetooth;
