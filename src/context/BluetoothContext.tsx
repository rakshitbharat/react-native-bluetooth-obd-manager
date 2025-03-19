import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import BleManager from 'react-native-ble-manager';

import { bluetoothReducer, initialState, BluetoothActionType } from './bluetoothReducer';
import { BluetoothState } from '../types/bluetoothTypes';
import { decodeData, isResponseComplete, encodeCommand, formatResponse } from '../utils/dataUtils';
import { findServiceAndCharacteristic, isOBDDevice } from '../utils/deviceUtils';
import { BluetoothOBDError, BluetoothErrorType } from '../utils/errorUtils';
import { requestBluetoothPermissions, checkBluetoothState } from '../utils/permissionUtils';
import {
  addDeviceToHistory,
  getLastConnectedDevice,
  getRecentDevices,
  saveLastConnectedDevice,
} from '../utils/statePersistence';
import notificationHandler, { RawResponse } from '../utils/notificationHandler';

export interface BluetoothContextType extends BluetoothState {
  scanDevices: (timeoutMs?: number) => Promise<boolean>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  disconnect: (deviceId: string) => Promise<boolean>;
  sendCommand: (command: string, timeoutMs?: number) => Promise<{ text: string; bytes: number[] }>;
  requestPermissions: () => Promise<boolean>;
  isConnected: boolean;
  getRecentDevices: () => Promise<any[]>;
  reconnectToLastDevice: () => Promise<boolean>;
}

// Create the context
export const BluetoothContext = createContext<BluetoothContextType | null>(null);

// BLE Manager module name
const BleManagerModule = NativeModules.BleManager;
const bleEmitter = new NativeEventEmitter(BleManagerModule);

// Constants
const CONNECTION_RETRY_ATTEMPTS = 3;
const CONNECTION_RETRY_DELAY = 1000;
const COMMAND_DEFAULT_TIMEOUT = 4000;

/**
 * Singleton class to handle Bluetooth data reception from OBD devices
 * Manages data buffering, timeouts and response completion detection
 */
class BLEDataReceiver {
  static instance: BLEDataReceiver;
  responseBuffer = '';
  rawResponseBuffer: number[] = [];
  rawCompleteResponse: number[] | null = null;
  completeResponseReceived = false;
  lastError: Error | null = null;
  receiveStartTime = 0;
  timeoutHandler: NodeJS.Timeout | null = null;
  responseResolver: ((value: { text: string; bytes: number[] }) => void) | null = null;
  responseRejecter: ((reason: Error) => void) | null = null;

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
      // Accumulate raw bytes
      this.rawResponseBuffer.push(...data.value);
      const decodedValue = decodeData(data.value);
      this.responseBuffer += decodedValue;

      // Check if we've received a complete response (contains '>')
      if (isResponseComplete(this.responseBuffer)) {
        this.rawCompleteResponse = [...this.rawResponseBuffer];
        this.completeResponseReceived = true;

        // If we have a pending promise resolver, resolve it with both text and bytes
        if (this.responseResolver) {
          this.responseResolver({
            text: this.responseBuffer,
            bytes: this.rawCompleteResponse
          });
          this.responseResolver = null;
          this.responseRejecter = null;
          this.clearTimeout();
        }

        return true;
      }

      return false;
    } catch (error) {
      this.lastError = error as Error;

      if (this.responseRejecter) {
        this.responseRejecter(this.lastError);
        this.responseResolver = null;
        this.responseRejecter = null;
        this.clearTimeout();
      }

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
    this.clearTimeout();
    this.responseResolver = null;
    this.responseRejecter = null;
  }

  getResponse(): { text: string; bytes: number[]; error: Error | null } {
    return {
      text: this.responseBuffer,
      bytes: this.rawCompleteResponse || [],  // Ensure we never return null
      error: this.lastError,
    };
  }

  async waitForResponse(timeoutMs: number = COMMAND_DEFAULT_TIMEOUT): Promise<{ text: string; bytes: number[] }> {
    if (this.completeResponseReceived && this.rawCompleteResponse) {
      const responseBytes = [...this.rawCompleteResponse];
      return {
        text: this.responseBuffer,
        bytes: responseBytes
      };
    }

    return new Promise<{ text: string; bytes: number[] }>((resolve, reject) => {
      this.responseResolver = resolve;
      this.responseRejecter = reject;

      this.timeoutHandler = setTimeout(() => {
        const timeoutError = new BluetoothOBDError(
          BluetoothErrorType.TIMEOUT_ERROR,
          `Command timed out after ${timeoutMs}ms`,
        );
        this.lastError = timeoutError;

        if (this.responseRejecter) {
          this.responseRejecter(timeoutError);
        }

        this.responseResolver = null;
        this.responseRejecter = null;
      }, timeoutMs);
    });
  }

  clearTimeout(): void {
    if (this.timeoutHandler !== null) {
      clearTimeout(this.timeoutHandler);
      this.timeoutHandler = null;
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
    isStreaming,
    pendingCommand,
  } = state;

  // Keep track of command timeout
  const commandTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Flag to track if we're currently establishing a connection
  const isConnectingRef = useRef<boolean>(false);

  // Send command to OBD device with timeout
  const sendCommand = async (command: string, timeoutMs = 5000): Promise<{ text: string; bytes: number[] }> => {
    if (!connectedDevice || !connectionDetails) {
      throw new BluetoothOBDError(BluetoothErrorType.CONNECTION_ERROR, 'No device connected');
    }

    if (!connectionDetails.writeCharacteristicUUID) {
      throw new BluetoothOBDError(
        BluetoothErrorType.CHARACTERISTIC_ERROR,
        'Missing write characteristic UUID',
      );
    }

    // Reset data receiver state
    dataReceiver.reset();

    // Format command with carriage return and encode to bytes
    const cmdWithCR = command.endsWith('\r') ? command : `${command}\r`;
    const commandBytes = encodeCommand(cmdWithCR);

    try {
      dispatch({ type: BluetoothActionType.SET_PENDING_COMMAND, payload: command });

      // Send the command using the right method based on the device capabilities
      if (connectionDetails.writeWithResponse) {
        await BleManager.write(
          connectedDevice.id,
          connectionDetails.serviceUUID,
          connectionDetails.writeCharacteristicUUID,
          commandBytes,
        );
      } else {
        await BleManager.writeWithoutResponse(
          connectedDevice.id,
          connectionDetails.serviceUUID,
          connectionDetails.writeCharacteristicUUID,
          commandBytes,
        );
      }

      // Wait for response with active checking and timeout
      let isComplete = false;
      const startTime = Date.now();

      while (!isComplete) {
        // Check if we've exceeded timeout
        if (Date.now() - startTime > timeoutMs) {
          throw new BluetoothOBDError(
            BluetoothErrorType.TIMEOUT_ERROR,
            `Command "${command}" timed out after ${timeoutMs}ms`,
          );
        }

        // Check if we have a complete response
        const { text } = dataReceiver.getResponse();
        if (isResponseComplete(text)) {
          isComplete = true;
          break;
        }

        // Small delay between checks
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const { text, bytes, error } = dataReceiver.getResponse();

      if (error) throw error;

      dispatch({ type: BluetoothActionType.SET_PENDING_COMMAND, payload: null });

      // Format the response to clean up cruft
      return {
        text: formatResponse(text, command),
        bytes: bytes
      };
    } catch (error) {
      // If there's an error, reset the streaming state
      dispatch({ type: BluetoothActionType.SET_STREAMING, payload: false });

      // If it's a timeout, throw a specific error
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new BluetoothOBDError(
          BluetoothErrorType.TIMEOUT_ERROR,
          `Command "${command}" timed out after ${timeoutMs}ms`,
        );
      }

      // Otherwise throw a general error
      throw new BluetoothOBDError(
        BluetoothErrorType.WRITE_ERROR,
        `Failed to send command: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  // Disconnect from current device
  const disconnect = useCallback(
    async (deviceId: string) => {
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
        if (connectedDevice && connectionDetails && connectionDetails.notifyCharacteristicUUID) {
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
        dispatch({ type: BluetoothActionType.SET_CONNECTED, payload: false });
        return true;
      } catch (error) {
        console.error('Disconnect failed:', error);
        return false;
      }
    },
    [connectedDevice, connectionDetails, sendCommand],
  );

  // Handle data notifications from device
  const handleNotification = useCallback(
    (data: { value: number[]; peripheral: string }) => {
      const { value, peripheral } = data;
      if (!connectedDevice || peripheral !== connectedDevice.id) return;

      // Update data in our singleton receiver
      dataReceiver.updateValueFromCharacteristic({ value });

      if (isStreaming && pendingCommand) {
        const { text } = dataReceiver.getResponse();
        dispatch({
          type: BluetoothActionType.SET_PENDING_COMMAND,
          payload: text,
        });
        // Check if this response is complete (contains '>')
        if (isResponseComplete(text)) {
          dispatch({ type: BluetoothActionType.SET_PENDING_COMMAND, payload: null });
        }
      }
    },
    [connectedDevice, isStreaming, pendingCommand],
  );

  // Initialize BLE Manager
  useEffect(() => {
    const initializeBluetooth = async () => {
      try {
        await BleManager.start({ showAlert: false });
        dispatch({ type: BluetoothActionType.SET_INITIALIZED, payload: true });

        const bluetoothState = await checkBluetoothState();
        dispatch({
          type: BluetoothActionType.SET_BLUETOOTH_ON,
          payload: bluetoothState,
        });

        const permissions = await requestBluetoothPermissions();
        dispatch({
          type: BluetoothActionType.SET_PERMISSIONS,
          payload: permissions,
        });
      } catch (error) {
        console.error('Failed to initialize Bluetooth:', error);
        dispatch({ type: BluetoothActionType.SET_INITIALIZED, payload: false });
      }
    };

    initializeBluetooth();

    return () => {
      BleManager.stopScan();
      if (connectedDevice) {
        disconnect(connectedDevice.id);
      }
    };
  }, [connectedDevice, disconnect]);

  // Set up Bluetooth event listeners
  useEffect(() => {
    if (!isInitialized) return;

    const stateChangeListener = bleEmitter.addListener('BleManagerDidUpdateState', ({ state }) => {
      dispatch({
        type: BluetoothActionType.SET_BLUETOOTH_ON,
        payload: state === 'on',
      });
    });

    const disconnectListener = bleEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      ({ peripheral }) => {
        if (connectedDevice && peripheral === connectedDevice.id) {
          dispatch({ type: BluetoothActionType.SET_CONNECTED, payload: false });
        }
      },
    );

    const dataListener = bleEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      handleNotification,
    );

    return () => {
      stateChangeListener.remove();
      disconnectListener.remove();
      dataListener.remove();
    };
  }, [isInitialized, connectedDevice, handleNotification]);

  // Handle streaming timeout (to prevent hanging if no response received)
  useEffect(() => {
    if (isStreaming) {
      // Set a timeout to reset streaming state if it gets stuck
      const timeoutId = setTimeout(() => {
        console.warn('Stream timeout - resetting stream state');
        dispatch({ type: BluetoothActionType.SET_STREAMING, payload: false });
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

  // Save last connected device when connecting/disconnecting
  useEffect(() => {
    if (connectedDevice) {
      // Save to device history when connected
      try {
        // Convert BluetoothDeviceInfo to Peripheral format if needed
        const peripheralDevice = {
          ...connectedDevice,
          advertising: { localName: connectedDevice.name },
        };
        addDeviceToHistory(peripheralDevice as any, isOBDDevice(peripheralDevice as any));
        saveLastConnectedDevice(connectedDevice.id);
      } catch (error) {
        console.warn('Error saving device history:', error);
      }
    }
  }, [connectedDevice]);

  // Scan for nearby Bluetooth devices
  const scanDevices = async (timeoutMs = 5000) => {
    if (isScanning) {
      // Already scanning - don't start another scan
      return true;
    }

    if (!isBluetoothOn || !hasPermissions) {
      dispatch({
        type: BluetoothActionType.SET_ERROR,
        payload: new BluetoothOBDError(
          BluetoothErrorType.PERMISSION_ERROR,
          'Bluetooth is off or permissions are not granted',
        ),
      });
      return false;
    }

    try {
      dispatch({ type: BluetoothActionType.SET_SCANNING, payload: true });

      // Start the scan
      await BleManager.scan([], timeoutMs, true);

      // Set up a listener for discovered devices
      const discoveryListener = bleEmitter.addListener('BleManagerDiscoverPeripheral', device => {
        if (device && (device.name || device.advertising?.localName)) {
          dispatch({
            type: BluetoothActionType.ADD_DEVICE,
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
          dispatch({ type: BluetoothActionType.SET_SCANNING, payload: false });
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
        payload: new BluetoothOBDError(BluetoothErrorType.SCAN_ERROR, 'Failed to scan for devices'),
      });
      dispatch({ type: BluetoothActionType.SET_SCANNING, payload: false });
      return false;
    }
  };

  // Enhanced connect function with better service discovery
  const connectToDevice = useCallback(
    async (deviceId: string) => {
      if (isConnectingRef.current) {
        return false;
      }

      if (connectedDevice) {
        await disconnect(connectedDevice.id);
      }

      isConnectingRef.current = true;
      dispatch({ type: BluetoothActionType.SET_CONNECTED, payload: false });

      let retryCount = CONNECTION_RETRY_ATTEMPTS;

      while (retryCount > 0) {
        try {
          // Check if already connected
          const isConnected = await BleManager.isPeripheralConnected(deviceId, []);

          if (!isConnected) {
            await BleManager.connect(deviceId);
            // Wait longer for older ELM327 devices that need more time to initialize
            await new Promise(resolve => setTimeout(resolve, 1500));
          }

          // Get device services with retries
          const peripheralInfo = await BleManager.retrieveServices(deviceId);

          if (!peripheralInfo.services || !peripheralInfo.characteristics) {
            throw new Error('Failed to retrieve services or characteristics');
          }

          // Use our enhanced service discovery
          const connectionDetails = await findServiceAndCharacteristic(peripheralInfo);

          if (!connectionDetails) {
            throw new Error('Could not find suitable service and characteristics');
          }

          // Start notification if notifyCharacteristicUUID is available
          if (connectionDetails.notifyCharacteristicUUID) {
            await BleManager.startNotification(
              deviceId,
              connectionDetails.serviceUUID,
              connectionDetails.notifyCharacteristicUUID,
            );
          }

          dispatch({
            type: BluetoothActionType.SET_CONNECTION_DETAILS,
            payload: connectionDetails,
          });

          dispatch({
            type: BluetoothActionType.SET_CONNECTED_DEVICE,
            payload: peripheralInfo,
          });

          isConnectingRef.current = false;

          // Initialize the device with some basic commands
          try {
            // Reset the adapter
            await sendCommand('ATZ');

            // Turn off echo
            await sendCommand('ATE0');

            // Turn off line feeds
            await sendCommand('ATL0');

            // Turn on automatic protocol detection
            await sendCommand('ATSP0');
          } catch (error) {
            console.warn('Failed to initialize device with AT commands:', error);
            // Continue even if initialization fails, as some devices work anyway
          }

          return true;
        } catch (error) {
          retryCount--;

          if (retryCount === 0) {
            dispatch({
              type: BluetoothActionType.SET_ERROR,
              payload: new BluetoothOBDError(
                BluetoothErrorType.CONNECTION_ERROR,
                (error as Error).message,
              ),
            });
            isConnectingRef.current = false;
            return false;
          }

          await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY));
        }
      }

      return false;
    },
    [connectedDevice, disconnect, sendCommand],
  );

  // Set up notification handler - now uses global handler
  useEffect(() => {
    if (connectedDevice) {
      // Set this device as the active peripheral for notifications
      notificationHandler.setActivePeripheral(connectedDevice.id);
      
      // Get response stream for this device
      const subscription = notificationHandler
        .getCompleteResponseStream(connectedDevice.id)
        .subscribe((response: RawResponse) => {
          if (isStreaming && pendingCommand) {
            dispatch({
              type: BluetoothActionType.SET_PENDING_COMMAND,
              payload: response.text,
            });
            
            if (isResponseComplete(response.text)) {
              dispatch({ type: BluetoothActionType.SET_PENDING_COMMAND, payload: null });
            }
          }
        });

      return () => {
        subscription.unsubscribe();
        if (connectedDevice) {
          notificationHandler.setActivePeripheral(null);
          disconnect(connectedDevice.id).catch(() => {
            /* Errors are already logged by console.warn */
          });
        }
      };
    }
  }, [connectedDevice, isStreaming, pendingCommand, disconnect]);

  // Get recent devices from history
  const fetchRecentDevices = useCallback(async () => {
    try {
      return await getRecentDevices();
    } catch (error) {
      console.error('Failed to get recent devices:', error);
      return [];
    }
  }, []);

  // Reconnect to the last connected device
  const reconnectToLastDevice = useCallback(async (): Promise<boolean> => {
    try {
      const lastDeviceId = await getLastConnectedDevice();

      if (!lastDeviceId) {
        return false;
      }

      return await connectToDevice(lastDeviceId);
    } catch (error) {
      console.error('Failed to reconnect to last device:', error);
      return false;
    }
  }, [connectToDevice]);

  // Context value
  const contextValue: BluetoothContextType = {
    ...state,
    scanDevices,
    connectToDevice,
    disconnect,
    sendCommand,
    requestPermissions: async () => {
      const permissions = await requestBluetoothPermissions();
      dispatch({
        type: BluetoothActionType.SET_PERMISSIONS,
        payload: permissions,
      });
      return permissions;
    },
    isConnected: !!connectedDevice,
    getRecentDevices: fetchRecentDevices,
    reconnectToLastDevice,
  };

  return (
    <BluetoothContext.Provider value={contextValue}>
      {isInitialized ? children : null}
    </BluetoothContext.Provider>
  );
};

// Export the provider as default
export default BluetoothProvider;

// Custom hook to use the Bluetooth context
export const useBluetooth = () => {
  const context = useContext(BluetoothContext);
  if (context === null) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  return context;
};
