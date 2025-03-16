import { Platform } from 'react-native';
import { PERMISSIONS, check, request, RESULTS, checkMultiple, requestMultiple } from 'react-native-permissions';
import BleManager from 'react-native-ble-manager';

// Get required permissions based on platform and version
const getRequiredPermissions = () => {
  if (Platform.OS === 'android') {
    return Platform.Version >= 31 
      ? [
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]
      : [
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
        ];
  } else if (Platform.OS === 'ios') {
    return [PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL];
  }
  return [];
};

export const requestBluetoothPermissions = async (retryAttempts = 2): Promise<boolean> => {
  const permissions = getRequiredPermissions();
  
  // No permissions needed
  if (permissions.length === 0) {
    return true;
  }

  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      // Check current permission status
      const statuses = await checkMultiple(permissions);
      
      // If all permissions are granted, return true
      if (Object.values(statuses).every(status => status === RESULTS.GRANTED)) {
        return true;
      }
      
      // Request all required permissions
      const results = await requestMultiple(permissions);
      
      // Check if all permissions were granted
      const allGranted = Object.values(results).every(result => result === RESULTS.GRANTED);
      
      if (allGranted) {
        return true;
      }
      
      // If this was our last attempt and we failed, return false
      if (attempt === retryAttempts) {
        console.warn('Failed to get all required permissions after', attempt, 'attempts');
        return false;
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error requesting permissions:', error);
      
      // If this was our last attempt, return false
      if (attempt === retryAttempts) {
        return false;
      }
    }
  }
  
  return false;
};

export const checkBluetoothState = async (retryAttempts = 2): Promise<boolean> => {
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      const state = await BleManager.checkState();
      return state === 'on';
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      
      // If this was our last attempt, return false
      if (attempt === retryAttempts) {
        return false;
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return false;
};

// Monitor Bluetooth state changes
export const startBluetoothStateMonitoring = (
  onStateChange: (isOn: boolean) => void
): (() => void) => {
  let stateChangeListener: any = null;
  
  try {
    const bleManagerEmitter = new NativeEventEmitter(NativeModules.BleManager);
    
    stateChangeListener = bleManagerEmitter.addListener(
      'BleManagerDidUpdateState',
      ({ state }) => {
        onStateChange(state === 'on');
      }
    );
    
    return () => {
      if (stateChangeListener) {
        stateChangeListener.remove();
      }
    };
  } catch (error) {
    console.error('Error setting up Bluetooth state monitoring:', error);
    return () => {}; // Return empty cleanup function
  }
};

// Validate if all required permissions are granted
export const validatePermissions = async (): Promise<boolean> => {
  const permissions = getRequiredPermissions();
  
  if (permissions.length === 0) {
    return true;
  }
  
  try {
    const statuses = await checkMultiple(permissions);
    return Object.values(statuses).every(status => status === RESULTS.GRANTED);
  } catch (error) {
    console.error('Error validating permissions:', error);
    return false;
  }
};
