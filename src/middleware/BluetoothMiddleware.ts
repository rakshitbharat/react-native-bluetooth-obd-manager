import BleManager from 'react-native-ble-manager';

import { ConnectionDetails } from '../types/bluetoothTypes';
import { encodeCommand, isResponseComplete } from '../utils/dataUtils';
import { findServiceAndCharacteristic } from '../utils/deviceUtils';

/**
 * Middleware for handling Bluetooth operations
 * This creates a unified interface for working with BLE OBD devices
 */
export class BluetoothMiddleware {
  private static instance: BluetoothMiddleware;
  private responseListeners: ((response: string) => void)[] = [];
  private responseTimer: NodeJS.Timeout | null = null;
  private currentResponseTimeout = 4000; // Default timeout

  private constructor() {
    // Private constructor for singleton pattern - initialization happens through getInstance()
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): BluetoothMiddleware {
    if (!BluetoothMiddleware.instance) {
      BluetoothMiddleware.instance = new BluetoothMiddleware();
    }
    return BluetoothMiddleware.instance;
  }
  public async findOBDConnectionDetails(deviceId: string): Promise<ConnectionDetails | null> {
    try {
      // First retrieve peripheral info with services
      const peripheralInfo = await BleManager.retrieveServices(deviceId);
      
      // Leverage the device utils to find appropriate connection details
      const connectionDetails = await findServiceAndCharacteristic(peripheralInfo);
      
      if (!connectionDetails) {
        console.error('Could not find compatible connection details for device');
        return null;
      }
      
      return connectionDetails;
    } catch (error) {
      console.error('Error finding connection details:', error);
      return null;
    }
  }

  /**
   * Process incoming data from BLE notification
   * Returns true if the response is complete
   */
  public processIncomingData(data: number[], response: string): boolean {
    // Cancel any existing response timeout
    if (this.responseTimer) {
      clearTimeout(this.responseTimer);
      this.responseTimer = null;
    }

    // Check if the response is complete (has the '>' prompt)
    const isComplete = isResponseComplete(response);
    
    // Notify all response listeners
    this.notifyListeners(response);
    
    return isComplete;
  }

  /**
   * Set a timeout for command response
   * After the timeout, we assume the response is complete/failed
   */
  public setResponseTimeout(timeoutMs: number, callback: () => void): void {
    this.currentResponseTimeout = timeoutMs;
    
    // Clear any existing timeout
    if (this.responseTimer) {
      clearTimeout(this.responseTimer);
    }
    
    // Set new timeout
    this.responseTimer = setTimeout(callback, timeoutMs);
  }

  /**
   * Subscribe to response data
   * Returns an unsubscribe function
   */
  public subscribeToResponses(listener: (response: string) => void): () => void {
    this.responseListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.responseListeners = this.responseListeners.filter(l => l !== listener);
    };
  }

  /**
   * Prepare command for sending to OBD device
   */
  public prepareCommand(command: string): number[] {
    // Make sure command ends with carriage return
    const cmdWithCR = command.endsWith('\r') ? command : `${command}\r`;
    return encodeCommand(cmdWithCR);
  }

  /**
   * Reset response handling state
   */
  public resetResponseHandling(): void {
    if (this.responseTimer) {
      clearTimeout(this.responseTimer);
      this.responseTimer = null;
    }
  }

  /**
   * Notify all listeners of new response data
   */
  private notifyListeners(response: string): void {
    this.responseListeners.forEach(listener => listener(response));
  }
}

export default BluetoothMiddleware.getInstance();
