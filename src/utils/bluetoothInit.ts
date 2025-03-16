import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import BleManager from 'react-native-ble-manager';

import { checkBluetoothPermissions, checkBluetoothState } from './permissionUtils';
import { BluetoothAction, BluetoothActionType } from '../types/bluetoothTypes';

const BleManagerModule = NativeModules.BleManager;
const bleEmitter = new NativeEventEmitter(BleManagerModule);

interface CharacteristicData {
  peripheral: string;
  characteristic: string;
  service: string;
  value: number[];
}

/**
 * Initialize Bluetooth functionality
 * @param dispatch Function to dispatch actions to the BluetoothContext reducer
 * @returns Cleanup function to remove event listeners
 */
export const initializeBluetooth = async (
  dispatch: React.Dispatch<BluetoothAction>
): Promise<() => void> => {
  try {
    // Start the BLE Manager
    await BleManager.start({ showAlert: false });
    dispatch({ type: BluetoothActionType.INITIALIZE_SUCCESS });

    // Check initial Bluetooth state and permissions
    const bluetoothState = await checkBluetoothState();
    dispatch({
      type: BluetoothActionType.UPDATE_BLUETOOTH_STATE,
      payload: bluetoothState
    });

    const permissions = await checkBluetoothPermissions();
    dispatch({
      type: BluetoothActionType.UPDATE_PERMISSIONS,
      payload: permissions
    });

    // Set up event listeners
    const stateChangeListener = bleEmitter.addListener(
      'BleManagerDidUpdateState',
      ({ state }) => {
        const isOn = state === 'on';
        dispatch({
          type: BluetoothActionType.UPDATE_BLUETOOTH_STATE,
          payload: isOn
        });
      }
    );

    const disconnectListener = bleEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      ({ peripheral }) => {
        dispatch({ 
          type: BluetoothActionType.DISCONNECT_SUCCESS 
        });
      }
    );

    const discoverListener = bleEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      (device) => {
        if (device.name || device.advertising?.localName) {
          dispatch({
            type: BluetoothActionType.DEVICE_DISCOVERED,
            payload: {
              ...device,
              name: device.name || device.advertising?.localName || 'Unknown Device'
            }
          });
        }
      }
    );

    // Return cleanup function
    return () => {
      stateChangeListener.remove();
      disconnectListener.remove();
      discoverListener.remove();
      
      // Stop scanning if app closes
      BleManager.stopScan().catch((error) => {
        console.warn('Error when stopping scan during cleanup:', error);
      });
    };
  } catch (error) {
    console.error('Failed to initialize Bluetooth:', error);
    dispatch({ type: BluetoothActionType.INITIALIZE_FAILURE });
    return () => {}; // Return empty cleanup function
  }
};

/**
 * Setup notification handling for a connected device
 * @param deviceId Connected device ID
 * @param serviceUUID Service UUID
 * @param characteristicUUID Notification characteristic UUID
 * @param dataHandler Function to process received data
 */
export const setupNotifications = async (
  deviceId: string,
  serviceUUID: string,
  characteristicUUID: string,
  dataHandler: (data: CharacteristicData) => void
): Promise<() => void> => {
  try {
    // Start notifications on the characteristic
    await BleManager.startNotification(
      deviceId,
      serviceUUID,
      characteristicUUID
    );
    
    // Listen for notification data
    const dataListener = bleEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      (data) => {
        if (data.peripheral === deviceId) {
          dataHandler(data);
        }
      }
    );
    
    // Return cleanup function
    return () => {
      dataListener.remove();
      BleManager.stopNotification(deviceId, serviceUUID, characteristicUUID)
        .catch((error) => {
          console.warn('Error stopping notification:', error);
        });
    };
  } catch (error) {
    console.error('Failed to setup notifications:', error);
    return () => {}; // Return empty cleanup function
  }
};

export async function startDeviceNotifications(
  deviceId: string,
  serviceUUID: string,
  characteristicUUID: string,
  dataHandler: (data: any) => void
): Promise<() => void> {
  try {
    const bleEmitter = new NativeEventEmitter(BleManagerModule);
    
    // Setup notification listener
    const dataListener = bleEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      (data) => {
        if (data.peripheral === deviceId) {
          dataHandler(data);
        }
      }
    );
    
    // Return cleanup function
    return () => {
      dataListener.remove();
      BleManager.stopNotification(deviceId, serviceUUID, characteristicUUID)
        .catch((error) => {
          console.warn('Error stopping notification:', error);
        });
    };
  } catch (error) {
    console.error('Failed to setup notifications:', error);
    return () => {
      // Cleanup not needed since setup failed
    };
  }
}
