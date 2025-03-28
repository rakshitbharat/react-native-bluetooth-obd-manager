import {
  Platform,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  NativeModulesStatic,
} from 'react-native';
import { PERMISSIONS, RESULTS, checkMultiple } from 'react-native-permissions';

import { BluetoothErrorType, BluetoothOBDError } from './errorUtils';

// Constants
const retryAttempts = 2;
const retryDelay = 1500;

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
 * Request Bluetooth permissions with retry logic
 * @param attempt Current attempt number (for internal retry logic)
 * @returns True if all required permissions granted
 */
export async function requestBluetoothPermissions(attempt = 1): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      return true; // iOS handles permissions through Info.plist
    }

    // Check Android version
    if (typeof Platform.Version === 'number' && Platform.Version < 23) {
      // Below Android 6.0, permissions are granted at install time
      return true;
    }

    // For Android 12+ (API level 31+), we need BLUETOOTH_SCAN and BLUETOOTH_CONNECT
    const needsNewPermissions = typeof Platform.Version === 'number' && Platform.Version >= 31;

    // Build the list of required permissions
    const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

    // Add the new permissions for Android 12+
    if (needsNewPermissions) {
      permissions.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      );
    } else {
      // For older Android versions
      permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
    }

    // Request the permissions
    const granted = await PermissionsAndroid.requestMultiple(permissions);

    // Check if all permissions were granted
    const allGranted = Object.values(granted).every(
      status => status === PermissionsAndroid.RESULTS.GRANTED,
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
 * Check if the app has all required Bluetooth permissions
 */
export async function checkBluetoothPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      return true; // iOS permissions are handled through Info.plist
    }

    // Check Android version
    if (typeof Platform.Version === 'number' && Platform.Version < 23) {
      // Below Android 6.0, permissions are granted at install time
      return true;
    }

    // For Android 12+ (API level 31+), we need BLUETOOTH_SCAN and BLUETOOTH_CONNECT
    const needsNewPermissions = typeof Platform.Version === 'number' && Platform.Version >= 31;

    const basePermissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

    const permissions = [...basePermissions];

    // Add new permissions for Android 12+
    if (needsNewPermissions) {
      permissions.push('android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT');
    }

    // Check all required permissions
    const results = await Promise.all(
      permissions.map(permission => PermissionsAndroid.check(permission)),
    );

    // Return true only if ALL permissions are granted
    return results.every((result: boolean) => result === true);
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

// Add proper type guard for Bluetooth state events
interface BluetoothStateEvent {
  state: 'on' | 'off' | 'turning_on' | 'turning_off' | 'unauthorized' | 'unknown';
}

function isBluetoothStateEvent(event: unknown): event is BluetoothStateEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'state' in event &&
    typeof (event as BluetoothStateEvent).state === 'string'
  );
}

// Remove the duplicate checkBluetoothState function and combine functionality
export const checkBluetoothState = async (): Promise<boolean> => {
  try {
    const manager = NativeModules.BleManager as unknown as NativeModulesStatic;

    return new Promise<boolean>((resolve, reject) => {
      try {
        const emitter = new NativeEventEmitter(manager);
        const subscription = emitter.addListener('BleManagerDidUpdateState', (event: unknown) => {
          subscription.remove();
          if (isBluetoothStateEvent(event)) {
            resolve(event.state === 'on');
          } else {
            reject(new Error('Invalid Bluetooth state event'));
          }
        });

        // Trigger state check
        manager.getState();
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    console.error('Error checking Bluetooth state:', error);
    return false;
  }
};

// Update event handling in monitorBluetoothState
export const monitorBluetoothState = (onStateChange: (isOn: boolean) => void): (() => void) => {
  const manager = NativeModules.BleManager as unknown as NativeModulesStatic;
  const bleEmitter = new NativeEventEmitter(manager);

  const subscription = bleEmitter.addListener('BleManagerDidUpdateState', (event: unknown) => {
    if (isBluetoothStateEvent(event)) {
      onStateChange(event.state === 'on');
    }
  });

  return () => subscription.remove();
};

/**
 * Request Bluetooth enabling on Android
 * On iOS, this will show instructions to the user
 */
export const requestBluetoothEnable = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      // On Android, we can request to enable Bluetooth
      try {
        return await NativeModules.BleManager.enableBluetooth();
      } catch {
        return false;
      }
    } else {
      // On iOS, we can't enable Bluetooth programmatically
      return false;
    }
  } catch (error) {
    console.error('Error requesting Bluetooth enable:', error);
    return false;
  }
};

/**
 * Complete Bluetooth setup (permissions + state check)
 * @returns True if Bluetooth is ready
 */
export const setupBluetooth = async (): Promise<boolean> => {
  try {
    // First check permissions
    const hasPermissions = await checkBluetoothPermissions();

    if (!hasPermissions) {
      const granted = await requestBluetoothPermissions();
      if (!granted) {
        throw new BluetoothOBDError(
          BluetoothErrorType.PERMISSION_ERROR,
          'Bluetooth permissions denied',
        );
      }
    }

    // Then check and request Bluetooth state
    const isEnabled = await checkBluetoothState();

    if (!isEnabled) {
      await requestBluetoothEnable();

      // Re-check after request
      const newState = await checkBluetoothState();
      return newState;
    }

    return true;
  } catch (error) {
    console.error('Error setting up Bluetooth:', error);
    return false;
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
