import { Platform, NativeEventEmitter, NativeModules, EmitterSubscription, PermissionsAndroid } from 'react-native';
import BleManager from 'react-native-ble-manager';
import { PERMISSIONS, RESULTS, checkMultiple } from 'react-native-permissions';

const retryAttempts = 2;
const retryDelay = 1000;

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
 * Request Bluetooth permissions for the app
 */
export async function requestBluetoothPermissions(attempt = 1): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      return true; // iOS handles permissions through Info.plist
    }

    // Android permissions
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
    ]);

    const allGranted = Object.values(granted).every(
      status => status === PermissionsAndroid.RESULTS.GRANTED
    );

    if (allGranted) {
      return true;
    }

    // If not all permissions were granted and we have attempts left, retry
    if (attempt < retryAttempts) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return requestBluetoothPermissions(attempt + 1);
    }

    // If this was our last attempt, return false
    console.warn('Failed to get all required permissions after', attempt, 'attempts');
    return false;
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
}

/**
 * Check if all required Bluetooth permissions are granted
 */
export async function checkBluetoothPermissions(attempt = 1): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      return true; // iOS handles permissions through Info.plist
    }

    // Android permissions
    const results = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
      PermissionsAndroid.check('android.permission.BLUETOOTH_SCAN'),
      PermissionsAndroid.check('android.permission.BLUETOOTH_CONNECT'),
    ]);

    return results.every(result => result === true);
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

/**
 * Check Bluetooth state
 */
export async function checkBluetoothState(attempt = 1): Promise<boolean> {
  try {
    const state = await BleManager.checkState();
    return state === 'on';
  } catch (error) {
    console.error('Error checking Bluetooth state:', error);
    
    // If this was our last attempt, return false
    if (attempt === retryAttempts) {
      return false;
    }
    
    // Otherwise retry after delay
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    return checkBluetoothState(attempt + 1);
  }
}

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
