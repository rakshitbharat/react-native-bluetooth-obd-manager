import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConnectionDetails } from '../types/bluetoothTypes';

const STORAGE_PREFIX = '@OBDManager:';
const KEYS = {
  BLUETOOTH_STATE: `${STORAGE_PREFIX}bluetooth_state`,
  LAST_DEVICE: `${STORAGE_PREFIX}last_device`,
  CONNECTION_DETAILS: `${STORAGE_PREFIX}connection_details`,
  DEVICE_PREFERENCES: `${STORAGE_PREFIX}device_preferences`,
};

interface DevicePreferences {
  writeWithResponse: boolean;
  autoInitialize: boolean;
  useCustomService?: string;
  useCustomCharacteristic?: string;
}

export interface StoredDeviceState {
  id: string;
  name: string;
  connectionDetails: ConnectionDetails;
  preferences: DevicePreferences;
  lastConnected: number;
}

/**
 * Save full Bluetooth state including device preferences
 */
export const saveBluetoothState = async (state: any): Promise<void> => {
  try {
    const serializableState = {
      isBluetoothOn: state.isBluetoothOn,
      hasPermissions: state.hasPermissions,
      discoveredDevices:
        state.discoveredDevices?.map((d: any) => ({
          id: d.id,
          name: d.name,
          rssi: d.rssi,
        })) || [],
    };

    await AsyncStorage.setItem(KEYS.BLUETOOTH_STATE, JSON.stringify(serializableState));
  } catch (error) {
    console.error('Failed to save Bluetooth state:', error);
  }
};

/**
 * Load Bluetooth state from persistent storage
 */
export const loadBluetoothState = async (): Promise<any> => {
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
 * Save the last connected device
 */
export const saveLastConnectedDevice = async (deviceId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.LAST_DEVICE, deviceId);
  } catch (error) {
    console.error('Failed to save last connected device:', error);
  }
};

/**
 * Get the last connected device
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
 * Save device connection details and preferences
 */
export const saveDeviceState = async (deviceState: StoredDeviceState): Promise<void> => {
  try {
    const key = `${KEYS.CONNECTION_DETAILS}:${deviceState.id}`;
    await AsyncStorage.setItem(key, JSON.stringify(deviceState));

    // Update last connected device
    await AsyncStorage.setItem(KEYS.LAST_DEVICE, deviceState.id);
  } catch (error) {
    console.error('Failed to save device state:', error);
  }
};

/**
 * Load device connection details and preferences
 */
export const loadDeviceState = async (deviceId: string): Promise<StoredDeviceState | null> => {
  try {
    const key = `${KEYS.CONNECTION_DETAILS}:${deviceId}`;
    const stateJson = await AsyncStorage.getItem(key);
    if (stateJson) {
      return JSON.parse(stateJson);
    }
    return null;
  } catch (error) {
    console.error('Failed to load device state:', error);
    return null;
  }
};

/**
 * Load all known device states
 */
export const loadAllDeviceStates = async (): Promise<StoredDeviceState[]> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const deviceKeys = keys.filter(key => key.startsWith(`${KEYS.CONNECTION_DETAILS}:`));

    const states = await Promise.all(
      deviceKeys.map(async key => {
        const json = await AsyncStorage.getItem(key);
        return json ? JSON.parse(json) : null;
      }),
    );

    return states.filter((state): state is StoredDeviceState => !!state);
  } catch (error) {
    console.error('Failed to load all device states:', error);
    return [];
  }
};

/**
 * Save device preferences
 */
export const saveDevicePreferences = async (
  deviceId: string,
  preferences: DevicePreferences,
): Promise<void> => {
  try {
    const key = `${KEYS.DEVICE_PREFERENCES}:${deviceId}`;
    await AsyncStorage.setItem(key, JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to save device preferences:', error);
  }
};

/**
 * Load device preferences
 */
export const loadDevicePreferences = async (
  deviceId: string,
): Promise<DevicePreferences | null> => {
  try {
    const key = `${KEYS.DEVICE_PREFERENCES}:${deviceId}`;
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Failed to load device preferences:', error);
    return null;
  }
};

/**
 * Clear all stored data for a specific device
 */
export const clearDeviceData = async (deviceId: string): Promise<void> => {
  try {
    const keys = [
      `${KEYS.CONNECTION_DETAILS}:${deviceId}`,
      `${KEYS.DEVICE_PREFERENCES}:${deviceId}`,
    ];

    await Promise.all(keys.map(key => AsyncStorage.removeItem(key)));

    // If this was the last connected device, clear that too
    const lastDevice = await AsyncStorage.getItem(KEYS.LAST_DEVICE);
    if (lastDevice === deviceId) {
      await AsyncStorage.removeItem(KEYS.LAST_DEVICE);
    }
  } catch (error) {
    console.error('Failed to clear device data:', error);
  }
};

/**
 * Clear all stored data
 */
export const clearAllData = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const obdKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    await AsyncStorage.multiRemove(obdKeys);
  } catch (error) {
    console.error('Failed to clear all data:', error);
  }
};
