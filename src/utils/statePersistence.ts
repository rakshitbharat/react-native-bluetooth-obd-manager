import AsyncStorage from '@react-native-async-storage/async-storage';
import { Peripheral } from 'react-native-ble-manager';

import { BluetoothState } from '../types/bluetoothTypes';

// Storage keys
const KEYS = {
  BLUETOOTH_STATE: '@OBDManager:bluetoothState',
  LAST_DEVICE: '@OBDManager:lastDevice',
  DEVICE_HISTORY: '@OBDManager:deviceHistory',
};

// Type definitions for serializable states
export interface SerializableBluetoothState {
  isBluetoothOn: boolean;
  hasPermissions: boolean;
  discoveredDevices?: Array<{
    id: string;
    name: string;
    rssi?: number;
  }>;
  lastConnectedDeviceId?: string;
}

/**
 * Save Bluetooth state to persistent storage
 * @param state Current Bluetooth state
 */
export const saveBluetoothState = async (state: BluetoothState): Promise<void> => {
  try {
    // Create a serializable version of the state
    const serializableState: SerializableBluetoothState = {
      // Set default values for optional properties
      isBluetoothOn: state.isBluetoothOn ?? false,
      hasPermissions: state.hasPermissions ?? false,
      discoveredDevices: state.discoveredDevices?.map(d => ({
        id: d.id,
        name: d.name || 'Unknown Device',
        rssi: d.rssi || 0,
      })) || [],
      lastConnectedDeviceId: state.connectedDevice?.id,
    };
    
    await AsyncStorage.setItem(KEYS.BLUETOOTH_STATE, JSON.stringify(serializableState));
  } catch (error) {
    console.error('Failed to save Bluetooth state:', error);
  }
};

/**
 * Load Bluetooth state from persistent storage
 * @returns Serialized Bluetooth state or null if none exists
 */
export const loadBluetoothState = async (): Promise<SerializableBluetoothState | null> => {
  try {
    const stateJson = await AsyncStorage.getItem(KEYS.BLUETOOTH_STATE);
    if (stateJson) {
      return JSON.parse(stateJson);
    }
    return null;
  } catch (error) {
    console.error('Failed to load Bluetooth state:', error);
    return null;
  }
};

/**
 * Remove saved Bluetooth state
 */
export const clearBluetoothState = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEYS.BLUETOOTH_STATE);
  } catch (error) {
    console.error('Failed to clear Bluetooth state:', error);
  }
};

/**
 * Save the last connected device ID
 */
export const saveLastConnectedDevice = async (deviceId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.LAST_DEVICE, deviceId);
  } catch (error) {
    console.error('Failed to save last connected device:', error);
  }
};

/**
 * Get the last connected device ID
 * @returns Device ID or null if none saved
 */
export const getLastConnectedDevice = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(KEYS.LAST_DEVICE);
  } catch (error) {
    console.error('Failed to get last connected device:', error);
    return null;
  }
};

/**
 * Clear the last connected device
 */
export const clearLastConnectedDevice = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEYS.LAST_DEVICE);
  } catch (error) {
    console.error('Failed to clear last connected device:', error);
  }
};

// Device history

export interface DeviceHistoryEntry {
  id: string;
  name: string;
  lastConnected: number; // timestamp
  connectionSuccessCount: number;
  isOBDDevice: boolean;
}

/**
 * Save device to history
 */
export const addDeviceToHistory = async (
  device: Peripheral, 
  isOBDDevice = true
): Promise<void> => {
  try {
    const history = await getDeviceHistory();
    
    // Find if device already exists
    const index = history.findIndex(d => d.id === device.id);
    
    if (index >= 0) {
      // Update existing entry
      history[index] = {
        ...history[index],
        name: device.name || history[index].name,
        lastConnected: Date.now(),
        connectionSuccessCount: (history[index].connectionSuccessCount || 0) + 1,
        isOBDDevice,
      };
    } else {
      // Add new entry
      history.push({
        id: device.id,
        name: device.name || 'Unknown Device',
        lastConnected: Date.now(),
        connectionSuccessCount: 1,
        isOBDDevice,
      });
    }
    
    // Save updated history
    await AsyncStorage.setItem(KEYS.DEVICE_HISTORY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to add device to history:', error);
  }
};

/**
 * Get device history
 */
export const getDeviceHistory = async (): Promise<DeviceHistoryEntry[]> => {
  try {
    const historyJson = await AsyncStorage.getItem(KEYS.DEVICE_HISTORY);
    if (historyJson) {
      return JSON.parse(historyJson);
    }
    return [];
  } catch (error) {
    console.error('Failed to get device history:', error);
    return [];
  }
};

/**
 * Clear device history
 */
export const clearDeviceHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEYS.DEVICE_HISTORY);
  } catch (error) {
    console.error('Failed to clear device history:', error);
  }
};

/**
 * Find device in history by ID
 */
export const findDeviceInHistory = async (deviceId: string): Promise<DeviceHistoryEntry | null> => {
  try {
    const history = await getDeviceHistory();
    return history.find(d => d.id === deviceId) || null;
  } catch (error) {
    console.error('Failed to find device in history:', error);
    return null;
  }
};

/**
 * Remove a device from history
 */
export const removeDeviceFromHistory = async (deviceId: string): Promise<void> => {
  try {
    const history = await getDeviceHistory();
    const filteredHistory = history.filter(d => d.id !== deviceId);
    await AsyncStorage.setItem(KEYS.DEVICE_HISTORY, JSON.stringify(filteredHistory));
  } catch (error) {
    console.error('Failed to remove device from history:', error);
  }
};

/**
 * Get most recently connected devices
 */
export const getRecentDevices = async (limit = 5): Promise<DeviceHistoryEntry[]> => {
  try {
    const history = await getDeviceHistory();
    
    // Sort by last connected timestamp (newest first) and take the most recent ones
    return history
      .sort((a, b) => b.lastConnected - a.lastConnected)
      .slice(0, limit);
  } catch (error) {
    console.error('Failed to get recent devices:', error);
    return [];
  }
};
