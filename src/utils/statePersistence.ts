import { AsyncStorage } from 'react-native';

const STORAGE_PREFIX = 'obd_manager_';
const BLUETOOTH_STATE_KEY = `${STORAGE_PREFIX}bluetooth_state`;

/**
 * Save Bluetooth state to persistent storage
 */
export const saveBluetoothState = async (state: any): Promise<void> => {
  try {
    // Only save serializable parts of the state
    const serializableState = {
      isBluetoothOn: state.isBluetoothOn,
      hasPermissions: state.hasPermissions,
      discoveredDevices: state.discoveredDevices?.map((d: any) => ({
        id: d.id,
        name: d.name,
        rssi: d.rssi
      })) || []
    };
    
    await AsyncStorage.setItem(
      BLUETOOTH_STATE_KEY,
      JSON.stringify(serializableState)
    );
  } catch (error) {
    console.error('Failed to save Bluetooth state:', error);
  }
};

/**
 * Load Bluetooth state from persistent storage
 */
export const loadBluetoothState = async (): Promise<any> => {
  try {
    const stateJson = await AsyncStorage.getItem(BLUETOOTH_STATE_KEY);
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
    await AsyncStorage.removeItem(BLUETOOTH_STATE_KEY);
  } catch (error) {
    console.error('Failed to clear Bluetooth state:', error);
  }
};

/**
 * Save the last connected device
 */
export const saveLastConnectedDevice = async (deviceId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}last_device`, deviceId);
  } catch (error) {
    console.error('Failed to save last connected device:', error);
  }
};

/**
 * Get the last connected device
 */
export const getLastConnectedDevice = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(`${STORAGE_PREFIX}last_device`);
  } catch (error) {
    console.error('Failed to get last connected device:', error);
    return null;
  }
};
