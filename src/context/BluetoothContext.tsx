import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import BleManager from 'react-native-ble-manager';
import { bluetoothReducer, initialState } from './bluetoothReducer';
import { requestBluetoothPermissions, checkBluetoothState } from '../utils/permissionUtils';
import { decodeData, isResponseComplete, encodeCommand, formatResponse } from '../utils/dataUtils';
import { findServiceAndCharacteristic } from '../utils/deviceUtils';
import { BluetoothActionType, BluetoothState } from '../types/bluetoothTypes';

// Create the context
export const BluetoothContext = createContext<any>(null);

// BLE Manager module name
const BleManagerModule = NativeModules.BleManager;
const bleEmitter = new NativeEventEmitter(BleManagerModule);

// Constants
const CONNECTION_RETRY_ATTEMPTS = 3;
const CONNECTION_RETRY_DELAY = 1000;
const COMMAND_DEFAULT_TIMEOUT = 4000;

// Common ELM327 service UUIDs
const DEFAULT_SERVICE_UUID_SHORT = 'fff0';
const DEFAULT_CHARACTERISTIC_UUID_SHORT = 'fff1';
const DEFAULT_SERVICE_UUID =
  Platform.OS === 'android' ? 'fff0' : '0000fff0-0000-1000-8000-00805f9b34fb';
const DEFAULT_CHARACTERISTIC_UUID =
  Platform.OS === 'android' ? 'fff1' : '0000fff1-0000-1000-8000-00805f9b34fb';
const WRITE_CHARACTERISTIC =
  Platform.OS === 'android' ? 'fff2' : '0000fff2-0000-1000-8000-00805f9b34fb';

const OBD_SERVICE_UUIDS = [
  'FFF0', // Most common
  'FFE0', // Alternative service
  '18F0', // Used by older adapters
  'BEEF', // Used by Chinese adapters
  'E7A1', // Another variant
  'FFE1', // Some Chinese clones
  'FFF1', // Another clone variant
];

const OBD_CHARACTERISTIC_UUIDS = [
  'FFF1', // Most common
  'FFE1', // Alternative
  'FF01', // Generic
  'E7A1', // Some older adapters
];

// Singleton for BLE data receiver
class BLEDataReceiver {
  static instance: BLEDataReceiver;
  responseBuffer: string = '';
  rawResponseBuffer: number[] = [];
  rawCompleteResponse: number[] | null = null;
  completeResponseReceived: boolean = false;
  lastError: Error | null = null;
  receiveStartTime: number = 0;

  static getInstance(): BLEDataReceiver {
    if (!BLEDataReceiver.instance) {
      BLEDataReceiver.instance = new BLEDataReceiver();
    }
    return BLEDataReceiver.instance;
  }

  startReceiving(): void {
    this.reset();
    this.receiveStartTime = Date.now();
  }

  updateValueFromCharacteristic(data: { value: number[] }): boolean {
    if (!data.value) return false;

    try {
      this.rawResponseBuffer.push(...data.value);
      const decodedValue = decodeData(data.value);
      this.responseBuffer += decodedValue;

      // Check if we've received a complete response (contains '>')
      if (isResponseComplete(this.responseBuffer)) {
        this.rawCompleteResponse = [...this.rawResponseBuffer];
        this.completeResponseReceived = true;
        return true;
      }

      // Check for timeout based on time since start
      if (Date.now() - this.receiveStartTime > COMMAND_DEFAULT_TIMEOUT) {
        throw new Error('Response timeout');
      }

      return false;
    } catch (error) {
      this.lastError = error as Error;
      return false;
    }
  }

  reset(): void {
    this.responseBuffer = '';
    this.rawResponseBuffer = [];
    this.rawCompleteResponse = null;
    this.completeResponseReceived = false;
    this.lastError = null;
    this.receiveStartTime = 0;
  }

  getResponse(): { response: string; error: Error | null } {
    return {
      response: this.responseBuffer,
      error: this.lastError,
    };
  }

  async waitForResponse(timeoutMs: number = COMMAND_DEFAULT_TIMEOUT): Promise<void> {
    const startTime = Date.now();
    while (!this.completeResponseReceived) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Response timeout');
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}

const dataReceiver = BLEDataReceiver.getInstance();

export const BluetoothProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(bluetoothReducer, initialState);
  const {
    isInitialized,
    isBluetoothOn,
    hasPermissions,
    connectedDevice,
    connectionDetails,
    isScanning,
    discoveredDevices,
    isStreaming,
    pendingCommand,
    responseData,
    error,
  } = state;

  // Keep track of command timeout
  const commandTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Flag to track if we're currently establishing a connection
  const isConnectingRef = useRef<boolean>(false);

  // Initialize BLE Manager
  useEffect(() => {
    const initializeBluetooth = async () => {
      try {
        // Start BLE Manager
        await BleManager.start({ showAlert: false });
        dispatch({ type: BluetoothActionType.INITIALIZE_SUCCESS });

        // Check initial Bluetooth state and permissions
        const bluetoothState = await checkBluetoothState();
        dispatch({
          type: BluetoothActionType.UPDATE_BLUETOOTH_STATE,
          payload: bluetoothState,
        });

        const permissions = await requestBluetoothPermissions();
        dispatch({
          type: BluetoothActionType.UPDATE_PERMISSIONS,
          payload: permissions,
        });
      } catch (error) {
        console.error('Failed to initialize Bluetooth:', error);
        dispatch({ type: BluetoothActionType.INITIALIZE_FAILURE });
      }
    };

    initializeBluetooth();

    // Cleanup
    return () => {
      BleManager.stopScan();
      if (connectedDevice) {
        disconnect(connectedDevice.id);
      }
    };
  }, []);

  // Set up Bluetooth event listeners
  useEffect(() => {
    if (!isInitialized) return;

    // Listen for state changes (Bluetooth on/off)
    const stateChangeListener = bleEmitter.addListener('BleManagerDidUpdateState', ({ state }) => {
      const isOn = state === 'on';
      dispatch({
        type: BluetoothActionType.UPDATE_BLUETOOTH_STATE,
        payload: isOn,
      });
    });

    // Listen for device disconnect events
    const disconnectListener = bleEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      ({ peripheral }) => {
        if (connectedDevice && peripheral === connectedDevice.id) {
          console.log('Device disconnected event received:', peripheral);
          dispatch({ type: BluetoothActionType.DISCONNECT_SUCCESS });
        }
      },
    );

    // Listen for data received from device
    const dataListener = bleEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      handleNotification,
    );

    return () => {
      stateChangeListener.remove();
      disconnectListener.remove();
      dataListener.remove();
    };
  }, [isInitialized, connectedDevice]);

  // Handle streaming timeout (to prevent hanging if no response received)
  useEffect(() => {
    if (isStreaming) {
      // Set a timeout to reset streaming state if it gets stuck
      const timeoutId = setTimeout(() => {
        console.warn('Stream timeout - resetting stream state');
        dispatch({ type: BluetoothActionType.RESET_STREAM });
      }, 4000); // 4 second timeout

      commandTimeoutRef.current = timeoutId;
    } else {
      // Clear timeout when not streaming
      if (commandTimeoutRef.current) {
        clearTimeout(commandTimeoutRef.current);
        commandTimeoutRef.current = null;
      }
    }

    return () => {
      if (commandTimeoutRef.current) {
        clearTimeout(commandTimeoutRef.current);
        commandTimeoutRef.current = null;
      }
    };
  }, [isStreaming]);

  // Handle data notifications from device
  const handleNotification = (data: any) => {
    const { value, peripheral, characteristic, service } = data;

    if (!connectedDevice || peripheral !== connectedDevice.id) return;

    // Update data in our singleton receiver
    dataReceiver.updateValueFromCharacteristic(data);

    if (isStreaming && pendingCommand) {
      const decodedData = decodeData(value);

      dispatch({
        type: BluetoothActionType.RECEIVE_DATA,
        payload: decodedData,
      });

      // Check if this response is complete (contains '>')
      if (isResponseComplete(decodedData)) {
        dispatch({ type: BluetoothActionType.COMPLETE_COMMAND });
      }
    }
  };

  // Scan for nearby Bluetooth devices
  const scanDevices = async (timeoutMs = 5000) => {
    if (!isBluetoothOn || !hasPermissions) {
      dispatch({
        type: BluetoothActionType.SET_ERROR,
        payload: 'Bluetooth is off or permissions are not granted',
      });
      return false;
    }

    try {
      dispatch({ type: BluetoothActionType.SCAN_START });

      // Start the scan
      await BleManager.scan([], timeoutMs, true);

      // Set up a listener for discovered devices
      const discoveryListener = bleEmitter.addListener('BleManagerDiscoverPeripheral', device => {
        if (device && (device.name || device.advertising?.localName)) {
          dispatch({
            type: BluetoothActionType.DEVICE_DISCOVERED,
            payload: {
              ...device,
              name: device.name || device.advertising?.localName || 'Unknown Device',
            },
          });
        }
      });

      // Stop scan after timeout
      setTimeout(async () => {
        try {
          await BleManager.stopScan();
          dispatch({ type: BluetoothActionType.SCAN_STOP });
          discoveryListener.remove();
        } catch (error) {
          console.warn('Error stopping scan:', error);
        }
      }, timeoutMs);

      return true;
    } catch (error) {
      console.error('Error scanning for devices:', error);
      dispatch({
        type: BluetoothActionType.SET_ERROR,
        payload: 'Failed to scan for devices',
      });
      dispatch({ type: BluetoothActionType.SCAN_STOP });
      return false;
    }
  };

  // Enhanced connect function with better service discovery
  const connectToDevice = async (deviceId: string) => {
    if (isConnectingRef.current) {
      console.log('Connection already in progress, aborting new connection request');
      return false;
    }

    if (connectedDevice) {
      await disconnect(connectedDevice.id);
    }

    isConnectingRef.current = true;
    dispatch({ type: BluetoothActionType.CONNECT_START });

    let retryCount = CONNECTION_RETRY_ATTEMPTS;

    while (retryCount > 0) {
      try {
        // Check if already connected
        const isConnected = await BleManager.isPeripheralConnected(deviceId, []);

        if (!isConnected) {
          await BleManager.connect(deviceId);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Get device services with retries
        const peripheralInfo = await BleManager.retrieveServices(deviceId);

        if (!peripheralInfo.services || !peripheralInfo.characteristics) {
          throw new Error('Failed to retrieve services or characteristics');
        }

        // Find OBD service
        const service = peripheralInfo.services.find(s => {
          const serviceUUID = Platform.OS === 'ios' ? s.uuid.toLowerCase() : s.uuid;
          return OBD_SERVICE_UUIDS.some(
            uuid =>
              serviceUUID === uuid.toLowerCase() ||
              serviceUUID === `0000${uuid.toLowerCase()}-0000-1000-8000-00805f9b34fb`,
          );
        });

        if (!service) {
          throw new Error('OBD service not found');
        }

        // Find characteristics
        const characteristics = peripheralInfo.characteristics.filter(
          c => c.service === service.uuid,
        );

        // Find write characteristic
        const writeCharacteristic = characteristics.find(c => {
          const canWrite =
            c.properties?.Write === 'Write' ||
            c.properties?.WriteWithoutResponse === 'WriteWithoutResponse';
          return canWrite;
        });

        // Find notify characteristic
        const notifyCharacteristic = characteristics.find(
          c =>
            c.properties?.Notify === 'Notify' ||
            c.characteristic === DEFAULT_CHARACTERISTIC_UUID_SHORT ||
            c.characteristic === DEFAULT_CHARACTERISTIC_UUID,
        );

        if (!writeCharacteristic || !notifyCharacteristic) {
          throw new Error('Required characteristics not found');
        }

        // Start notification
        await BleManager.startNotification(
          deviceId,
          service.uuid,
          notifyCharacteristic.characteristic,
        );

        // Store connection details
        const connectionDetails = {
          serviceUUID: service.uuid,
          writeCharacteristicUUID: writeCharacteristic.characteristic,
          notifyCharacteristicUUID: notifyCharacteristic.characteristic,
          writeWithResponse: writeCharacteristic.properties?.Write === 'Write',
        };

        dispatch({
          type: BluetoothActionType.CONNECT_SUCCESS,
          payload: {
            device: peripheralInfo,
            details: connectionDetails,
          },
        });

        isConnectingRef.current = false;
        return true;
      } catch (error) {
        console.warn(
          `Connection attempt ${CONNECTION_RETRY_ATTEMPTS - retryCount + 1} failed:`,
          error,
        );
        retryCount--;

        if (retryCount === 0) {
          dispatch({
            type: BluetoothActionType.CONNECT_FAILURE,
            payload: (error as Error).message,
          });
          isConnectingRef.current = false;
          return false;
        }

        await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY));
      }
    }

    return false;
  };

  // Enhanced sendCommand with direct response waiting
  const sendCommand = async (
    command: string,
    timeoutMs: number = COMMAND_DEFAULT_TIMEOUT,
  ): Promise<string> => {
    if (!connectedDevice || !connectionDetails) {
      throw new Error('No device connected');
    }

    dataReceiver.reset();

    const cmdWithCR = command.endsWith('\r') ? command : `${command}\r`;
    const bytes = encodeCommand(cmdWithCR);

    try {
      dispatch({ type: BluetoothActionType.SEND_COMMAND, payload: command });

      // Send command based on write characteristic type
      if (connectionDetails.writeWithResponse) {
        await BleManager.write(
          connectedDevice.id,
          connectionDetails.serviceUUID,
          connectionDetails.writeCharacteristicUUID,
          bytes,
        );
      } else {
        await BleManager.writeWithoutResponse(
          connectedDevice.id,
          connectionDetails.serviceUUID,
          connectionDetails.writeCharacteristicUUID,
          bytes,
        );
      }

      // Wait for response using dataReceiver
      await dataReceiver.waitForResponse(timeoutMs);

      const { response, error } = dataReceiver.getResponse();

      if (error) throw error;

      dispatch({ type: BluetoothActionType.COMPLETE_COMMAND });
      return formatResponse(response, command);
    } catch (error) {
      dispatch({ type: BluetoothActionType.RESET_STREAM });
      throw error;
    }
  };

  // Enhanced disconnect with proper cleanup
  const disconnect = async (deviceId: string) => {
    if (!deviceId) return false;

    try {
      // Send reset command before disconnecting
      try {
        await sendCommand('ATZ');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn('Error sending reset command:', error);
      }

      // Stop scanning if active
      await BleManager.stopScan();

      // Stop notifications if active
      if (connectedDevice && connectionDetails) {
        try {
          await BleManager.stopNotification(
            deviceId,
            connectionDetails.serviceUUID,
            connectionDetails.notifyCharacteristicUUID,
          );
        } catch (error) {
          console.warn('Error stopping notification:', error);
        }
      }

      // Reset data receiver
      dataReceiver.reset();

      // Disconnect device
      await BleManager.disconnect(deviceId);

      // Small delay to ensure proper cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      dispatch({ type: BluetoothActionType.DISCONNECT_SUCCESS });
      return true;
    } catch (error) {
      console.error('Disconnect failed:', error);
      return false;
    }
  };

  // Context value
  const contextValue = {
    ...state,
    scanDevices,
    connectToDevice,
    disconnect,
    sendCommand,
    requestPermissions: async () => {
      const permissions = await requestBluetoothPermissions();
      dispatch({
        type: BluetoothActionType.UPDATE_PERMISSIONS,
        payload: permissions,
      });
      return permissions;
    },
    isConnected: !!connectedDevice,
  };

  // Render children only if Bluetooth is initialized
  return (
    <BluetoothContext.Provider value={contextValue}>
      {isInitialized ? children : null}
    </BluetoothContext.Provider>
  );
};

// Custom hook to use the Bluetooth context
export const useBluetooth = () => {
  const context = useContext(BluetoothContext);
  if (context === null) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  return context;
};
