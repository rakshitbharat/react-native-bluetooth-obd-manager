import { useContext } from 'react';

import { BluetoothContext } from '../context/BluetoothContext';
import { BluetoothContextValue } from '../types/bluetoothTypes';
import { BluetoothOBDError, BluetoothErrorType } from '../utils/errorUtils';

/**
 * Hook to access the Bluetooth context
 * @returns The Bluetooth context values and methods
 * @throws {BluetoothOBDError} If used outside of a BluetoothProvider
 */
export const useBluetooth = (): BluetoothContextValue => {
  const context = useContext(BluetoothContext);

  if (context === null) {
    throw new BluetoothOBDError(
      BluetoothErrorType.INITIALIZATION_ERROR,
      'useBluetooth must be used within a BluetoothProvider',
    );
  }

  return context;
};
