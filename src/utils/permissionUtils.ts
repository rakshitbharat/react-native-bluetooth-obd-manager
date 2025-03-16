import { Platform, NativeEventEmitter, NativeModules, EmitterSubscription } from 'react-native';
import BleManager from 'react-native-ble-manager';
import { PERMISSIONS, RESULTS, checkMultiple } from 'react-native-permissions';

// Get required permissions based on platform and version
const getRequiredPermissions = () => {
  if (Platform.OS === 'android') {
    return Platform.Version >= 31
      ? [
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]
      : [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];
  } else if (Platform.OS === 'ios') {
    return [PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL];
  }
  return [];
};

/**
 * Request all required Bluetooth permissions
 */
export const requestBluetoothPermissions = async (retryAttempts = 2): Promise<boolean> => {
  let attempt = 1;
  while (attempt <= retryAttempts) {
    try {
      // For now, just check state - implement actual permission requests later
      const state = await checkBluetoothState();
      if (state) {
        return true;
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
    
    // If this was our last attempt, return false
    if (attempt === retryAttempts) {
      console.warn('Failed to get all required permissions after', attempt, 'attempts');
      return false;
    }
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempt++;
  }
  return false;
};

/**
 * Check Bluetooth state with retries
 */
export const checkBluetoothState = async (retryAttempts = 2): Promise<boolean> => {
  let attempt = 1;
  while (attempt <= retryAttempts) {
    try {
      const state = await BleManager.checkState();
      return state === 'on';
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      
      // If this was our last attempt, return false
      if (attempt === retryAttempts) {
        return false;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempt++;
    }
  }
  return false;
};

// Monitor Bluetooth state changes
export const startBluetoothStateMonitoring = (
  onStateChange: (isOn: boolean) => void,
): (() => void) => {
  let stateChangeListener: EmitterSubscription | null = null;

  try {
    const bleManagerEmitter = new NativeEventEmitter(NativeModules.BleManager);

    stateChangeListener = bleManagerEmitter.addListener('BleManagerDidUpdateState', ({ state }) => {
      onStateChange(state === 'on');
    });

    return () => {
      if (stateChangeListener) {
        stateChangeListener.remove();
      }
    };
  } catch (error) {
    console.error('Error setting up Bluetooth state monitoring:', error);
    // Return no-op cleanup function since there's nothing to clean up in error case
    return () => {
      /* Intentionally empty - no cleanup needed when setup failed */
    };
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

/**
 * Check if we have all required Bluetooth permissions
 */
export const checkBluetoothPermissions = async (): Promise<boolean> => {
  try {
    // Implement platform-specific permission checks here
    return true;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
};
