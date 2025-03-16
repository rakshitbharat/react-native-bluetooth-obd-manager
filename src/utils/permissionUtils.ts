import { Platform } from 'react-native';
import { PERMISSIONS, check, request, RESULTS } from 'react-native-permissions';
import BleManager from 'react-native-ble-manager';

export const requestBluetoothPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    // Different permissions based on Android version
    const permissions = Platform.Version >= 31 
      ? [
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]
      : [
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
        ];
    
    try {
      // Request each permission
      const results = await Promise.all(
        permissions.map(permission => request(permission))
      );
      
      // Check if all permissions are granted
      return results.every(result => result === RESULTS.GRANTED);
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  } else if (Platform.OS === 'ios') {
    try {
      // iOS uses the Bluetooth permission built into the BLE library
      const state = await BleManager.checkState();
      if (state === 'on') {
        return true;
      } else {
        // For iOS, we can check if the user has allowed Bluetooth by the state
        return false;
      }
    } catch (error) {
      console.error('Error checking iOS Bluetooth permissions:', error);
      return false;
    }
  }
  
  return false;
};

export const checkBluetoothState = async (): Promise<boolean> => {
  try {
    const state = await BleManager.checkState();
    return state === 'on';
  } catch (error) {
    console.error('Error checking Bluetooth state:', error);
    return false;
  }
};
