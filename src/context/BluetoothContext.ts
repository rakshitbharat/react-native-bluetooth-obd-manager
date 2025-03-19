import React, { createContext, useReducer, useContext, useCallback, ReactNode, FC } from 'react';
import { BluetoothState, BluetoothDeviceInfo, ConnectionDetails, BluetoothContextValue } from '../types/bluetoothTypes';
import { bluetoothReducer, initialState as initialBluetoothState, bluetoothActions } from './bluetoothReducer';
import { BluetoothOBDError } from '../utils/errorUtils';

// Use the BluetoothContextValue from types instead of redefining it
export const BluetoothContext = createContext<BluetoothContextValue | null>(null);

interface BluetoothProviderProps {
  children: ReactNode;
  onError?: (error: BluetoothOBDError) => void;
}

export const BluetoothProvider: FC<BluetoothProviderProps> = ({ 
  children, 
  onError 
}) => {
  const [state, dispatch] = useReducer(bluetoothReducer, initialBluetoothState);

  // Implement methods matching BluetoothContextValue interface
  const initialize = useCallback(async (): Promise<boolean> => {
    // Implementation would go here
    return true;
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    // Implementation would go here
    return true;
  }, []);

  const scanDevices = useCallback(async (timeoutMs?: number): Promise<boolean> => {
    dispatch(bluetoothActions.setScanning(true));
    // Implementation would go here
    return true;
  }, []);

  const connectToDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    // Find device by ID and connect
    const device = state.devices.find(d => d.id === deviceId);
    if (device) {
      dispatch(bluetoothActions.addDevice(device));
      dispatch(bluetoothActions.setConnected(true));
      return true;
    }
    return false;
  }, [state.devices]);

  const disconnect = useCallback(async (deviceId?: string): Promise<boolean> => {
    dispatch(bluetoothActions.setConnected(false));
    dispatch(bluetoothActions.setConnectionDetails(null));
    return true;
  }, []);

  const sendCommand = useCallback(async (command: string, timeoutMs?: number): Promise<string> => {
    // Implementation would go here
    return "";
  }, []);

  const reconnectToLastDevice = useCallback(async (): Promise<boolean> => {
    // Implementation would go here
    return false;
  }, []);

  const getRecentDevices = useCallback((): BluetoothDeviceInfo[] => {
    return state.devices;
  }, [state.devices]);

  // Map the state to match the BluetoothContextValue interface
  const value: BluetoothContextValue = {
    isInitialized: state.isInitialized ?? false,
    isScanning: state.isScanning,
    isConnected: state.isConnected,
    isBluetoothOn: state.isBluetoothOn ?? false,
    hasPermissions: state.hasPermissions ?? false,
    devices: state.devices,
    discoveredDevices: state.discoveredDevices ?? [],
    connectedDevice: state.connectedDevice ?? null,
    connectionDetails: state.connectionDetails,
    error: state.error,
    isStreaming: state.isStreaming ?? false,
    pendingCommand: state.pendingCommand ?? null,
    
    // Methods
    initialize,
    requestPermissions,
    scanDevices,
    connectToDevice,
    disconnect,
    sendCommand,
    reconnectToLastDevice,
    getRecentDevices
  };

  return React.createElement(BluetoothContext.Provider, { value }, children);
};

// Remove duplicate useBluetooth function since it's defined in src/hooks/useBluetooth.ts
export default BluetoothContext;