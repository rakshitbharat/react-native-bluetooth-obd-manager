import { useContext } from 'react';
import { BluetoothContext } from '../context/BluetoothContext';
import { BluetoothContextValue } from '../types/bluetoothTypes';

export const useBluetooth = (): BluetoothContextValue => {
  const context = useContext(BluetoothContext);
  
  if (context === null) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  
  // Cast the context to BluetoothContextValue to match the expected interface
  return context as BluetoothContextValue;
};
