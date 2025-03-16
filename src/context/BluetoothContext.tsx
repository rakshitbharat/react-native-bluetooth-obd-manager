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

// Singleton for BLE data receiver
class BLEDataReceiver {
  static instance: BLEDataReceiver;
  responseBuffer: string = '';
  rawResponseBuffer: number[] = [];
  rawCompleteResponse: number[] | null = null;
  completeResponseReceived: boolean = false;

  static getInstance(): BLEDataReceiver {
    if (!BLEDataReceiver.instance) {
      BLEDataReceiver.instance = new BLEDataReceiver();
    }
    return BLEDataReceiver.instance;
  }

  updateValueFromCharacteristic(data: { value: number[] }) {
    if (!data.value) return;
    
    this.rawResponseBuffer.push(...data.value);
    const decodedValue = decodeData(data.value);
    this.responseBuffer += decodedValue;
    
    // Check if we've received a complete response (contains '>')
    if (isResponseComplete(this.responseBuffer)) {
      this.rawCompleteResponse = [...this.rawResponseBuffer];
      this.completeResponseReceived = true;
    }
  }

  reset() {
    this.responseBuffer = '';
    this.rawResponseBuffer = [];
    this.rawCompleteResponse = null;
    this.completeResponseReceived = false;
  }
}

const dataReceiver = BLEDataReceiver.getInstance();

export const BluetoothProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
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
    error
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
          payload: bluetoothState 
        });
        
        const permissions = await requestBluetoothPermissions();
        dispatch({ 
          type: BluetoothActionType.UPDATE_PERMISSIONS, 
          payload: permissions 
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
    
    // Listen for device disconnect events
    const disconnectListener = bleEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      ({ peripheral }) => {
        if (connectedDevice && peripheral === connectedDevice.id) {
          console.log('Device disconnected event received:', peripheral);
          dispatch({ type: BluetoothActionType.DISCONNECT_SUCCESS });
        }
      }
    );
    
    // Listen for data received from device
    const dataListener = bleEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      handleNotification
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
        payload: decodedData
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
        payload: 'Bluetooth is off or permissions are not granted'
      });
      return false;
    }
    
    try {
      dispatch({ type: BluetoothActionType.SCAN_START });
      
      // Start the scan
      await BleManager.scan([], timeoutMs, true);
      
      // Set up a listener for discovered devices
      const discoveryListener = bleEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        (device) => {
          if (device && (device.name || device.advertising?.localName)) {
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
        payload: 'Failed to scan for devices'
      });
      dispatch({ type: BluetoothActionType.SCAN_STOP });
      return false;
    }
  };

  // Connect to a specific device by ID
  const connectToDevice = async (deviceId: string) => {
    if (isConnectingRef.current) {
      console.log('Connection already in progress, aborting new connection request');
      return false;
    }

    if (connectedDevice) {
      // Disconnect from existing device first
      await disconnect(connectedDevice.id);
    }
    
    isConnectingRef.current = true;
    dispatch({ type: BluetoothActionType.CONNECT_START });
    
    try {
      // Connect to the peripheral
      await BleManager.connect(deviceId);
      console.log('Connected to device:', deviceId);
      
      // Small delay to ensure connection is stable (like in reference code)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find the appropriate service and characteristic
      const connectionDetails = await findServiceAndCharacteristic(deviceId);
      
      if (!connectionDetails) {
        throw new Error('Could not find compatible service and characteristics');
      }
      
      console.log('Found connection details:', connectionDetails);
      
      // Start notifications
      await BleManager.startNotification(
        deviceId, 
        connectionDetails.serviceUUID, 
        connectionDetails.notifyCharacteristicUUID
      );
      console.log('Started notifications');
      
      // Get peripheral details
      const peripheralInfo = await BleManager.retrieveServices(deviceId);
      
      dispatch({
        type: BluetoothActionType.CONNECT_SUCCESS,
        payload: {
          device: peripheralInfo,
          details: connectionDetails
        }
      });
      
      isConnectingRef.current = false;
      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      dispatch({ 
        type: BluetoothActionType.CONNECT_FAILURE, 
        payload: (error as Error).message 
      });
      isConnectingRef.current = false;
      return false;
    }
  };

  // Disconnect from current device
  const disconnect = async (deviceId: string) => {
    if (!deviceId) return false;
    
    try {
      // If we have notification active, stop it
      if (connectedDevice && connectionDetails) {
        try {
          await BleManager.stopNotification(
            deviceId,
            connectionDetails.serviceUUID,
            connectionDetails.notifyCharacteristicUUID
          );
        } catch (error) {
          console.warn('Error stopping notification:', error);
        }
      }
      
      // Reset data receiver
      dataReceiver.reset();
      
      // Disconnect from the device
      await BleManager.disconnect(deviceId);
      dispatch({ type: BluetoothActionType.DISCONNECT_SUCCESS });
      return true;
    } catch (error) {
      console.error('Disconnect failed:', error);
      return false;
    }
  };

  // Send a command to the OBD device and wait for response
  const sendCommand = async (command: string, timeoutMs = 2000): Promise<string> => {
    if (!connectedDevice || !connectionDetails) {
      throw new Error('No device connected');
    }
    
    // Reset data receiver before sending new command
    dataReceiver.reset();
    
    // Convert command to bytes and add carriage return if not present
    const cmdWithCR = command.endsWith('\r') ? command : `${command}\r`;
    const bytes = encodeCommand(cmdWithCR);
    
    // Set up a promise that will resolve when we get the complete response
    return new Promise((resolve, reject) => {
      // Update state to indicate we're expecting a response
      dispatch({ 
        type: BluetoothActionType.SEND_COMMAND, 
        payload: command 
      });
      
      // Send the command
      BleManager.write(
        connectedDevice.id,
        connectionDetails.serviceUUID,
        connectionDetails.writeCharacteristicUUID,
        bytes,
        connectionDetails.writeWithResponse
      ).catch((error) => {
        dispatch({ type: BluetoothActionType.RESET_STREAM });
        reject(new Error(`Failed to send command: ${error.message}`));
      });
      
      // Set a timeout for the response
      const timeoutId = setTimeout(() => {
        dispatch({ type: BluetoothActionType.RESET_STREAM });
        reject(new Error('Command timed out'));
      }, timeoutMs);
      
      // Set up a response listener
      const checkResponse = setInterval(() => {
        if (!isStreaming || dataReceiver.completeResponseReceived) {
          // Command has completed
          clearTimeout(timeoutId);
          clearInterval(checkResponse);
          
          // Format the response and resolve
          const formattedResponse = formatResponse(responseData, command);
          resolve(formattedResponse);
        }
      }, 100);
    });
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
        payload: permissions 
      });
      return permissions;
    },
    isConnected: !!connectedDevice
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
