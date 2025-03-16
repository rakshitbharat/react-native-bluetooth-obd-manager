import BleManager from 'react-native-ble-manager';
import { BluetoothErrorType, BluetoothOBDError } from '../utils/errorUtils';
import { encodeCommand, decodeData, isResponseComplete, formatResponse } from '../utils/dataUtils';
import { ELM_COMMANDS } from '../utils/obdUtils';

/**
 * Interface for any ECU connector implementation
 */
export interface IECUConnector {
  sendCommand(command: string, timeoutMs?: number): Promise<string>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * ECU Connector class for interacting with OBD devices
 */
export class ECUConnector {
  private context: any;
  private deviceId: string | null = null;
  private responseTimeout: number = 4000; // Default timeout in ms
  private isInitialized: boolean = false;
  
  constructor() {
    // Default constructor for tests
  }
  
  /**
   * Set Bluetooth context to use for communication
   */
  setContext(context: any): void {
    this.context = context;
    this.isInitialized = true;
  }
  
  /**
   * Set connected device ID
   */
  setDeviceId(deviceId: string): void {
    this.deviceId = deviceId;
    this.isInitialized = true;
  }
  
  /**
   * Check if the connector is connected to a device
   */
  isConnected(): boolean {
    // Device must be explicitly set and not null
    return Boolean(this.context && this.deviceId);
  }
  
  /**
   * Send a command to the OBD device
   * @param command Command to send
   * @param timeout Optional timeout in milliseconds
   */
  async sendCommand(command: string, timeout?: number): Promise<string> {
    if (!this.context || !this.deviceId) {
      throw new BluetoothOBDError(
        BluetoothErrorType.CONNECTION_ERROR,
        'Not connected to ECU'
      );
    }
    
    try {
      // Don't add a default timeout, let it be undefined if not provided
      const response = await this.context.sendCommand(command, timeout);
      return response;
    } catch (error) {
      if (error instanceof BluetoothOBDError) {
        throw error;
      }
      throw new BluetoothOBDError(
        BluetoothErrorType.WRITE_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  
  /**
   * Disconnect from the device
   */
  async disconnect(): Promise<void> {
    if (!this.isInitialized || !this.deviceId) {
      return;
    }
    
    try {
      if (this.context?.disconnect) {
        await this.context.disconnect(this.deviceId);
      }
      this.deviceId = null;
      this.isInitialized = false;
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.DISCONNECTION_ERROR,
        `Failed to disconnect: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Reset the device (send ATZ command)
   */
  async reset(): Promise<string> {
    if (!this.isInitialized) {
      throw new BluetoothOBDError(
        BluetoothErrorType.CONNECTION_ERROR,
        'Not initialized'
      );
    }
    // Pass default timeout for reset command
    return this.sendCommand('ATZ', this.responseTimeout);
  }
  
  /**
   * Set response timeout
   */
  setResponseTimeout(timeout: number): void {
    this.responseTimeout = timeout;
  }
}

/**
 * Bluetooth ECU Connector implementation
 * Uses BLE Manager to communicate with OBD devices
 */
export class BluetoothECUConnector implements IECUConnector {
  private deviceId: string;
  private serviceUUID: string;
  private writeCharacteristic: string;
  private notifyCharacteristic: string;
  private writeWithResponse: boolean;
  private isConnectedFlag: boolean = false;
  private responseBuffer: string = '';
  private responseCallback: ((response: string) => void) | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private responsePromise: Promise<string> | null = null;
  private responseResolver: ((value: string) => void) | null = null;
  private responseRejector: ((reason: any) => void) | null = null;
  
  constructor(
    deviceId: string,
    serviceUUID: string,
    writeCharacteristic: string,
    notifyCharacteristic: string,
    writeWithResponse: boolean = true
  ) {
    this.deviceId = deviceId;
    this.serviceUUID = serviceUUID;
    this.writeCharacteristic = writeCharacteristic;
    this.notifyCharacteristic = notifyCharacteristic;
    this.writeWithResponse = writeWithResponse;
  }
  
  /**
   * Connect to the device and start notification
   */
  public async connect(): Promise<boolean> {
    if (this.isConnectedFlag) {
      return true;
    }
    
    try {
      // Check if already connected
      const isConnected = await BleManager.isPeripheralConnected(this.deviceId, []);
      
      if (!isConnected) {
        await BleManager.connect(this.deviceId);
        await new Promise(resolve => setTimeout(resolve, 500)); // Short delay after connection
      }
      
      // Start notification on the characteristic
      await BleManager.startNotification(
        this.deviceId,
        this.serviceUUID,
        this.notifyCharacteristic
      );
      
      this.isConnectedFlag = true;
      return true;
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.CONNECTION_ERROR,
        `Failed to connect to ECU: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }
  
  /**
   * Disconnect from the device
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnectedFlag) {
      return;
    }
    
    try {
      // Clean up any pending response
      this.clearResponse();
      
      // Stop notification
      try {
        await BleManager.stopNotification(
          this.deviceId,
          this.serviceUUID,
          this.notifyCharacteristic
        );
      } catch (e) {
        // Ignore errors in stopping notification
      }
      
      // Disconnect
      await BleManager.disconnect(this.deviceId);
      this.isConnectedFlag = false;
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.DISCONNECTION_ERROR,
        `Error disconnecting from ECU: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }
  
  /**
   * Send a command to the OBD device and wait for response
   * @param command Command to send
   * @param timeoutMs Optional timeout in ms
   * @returns Formatted response string
   */
  public async sendCommand(command: string, timeoutMs: number = 5000): Promise<string> {
    if (!this.isConnectedFlag) {
      throw new BluetoothOBDError(
        BluetoothErrorType.CONNECTION_ERROR,
        'Not connected to ECU'
      );
    }
    
    // Prepare for the response
    this.clearResponse();
    this.setupResponsePromise();
    
    // Add carriage return if needed
    const cmdWithCR = command.endsWith('\r') ? command : `${command}\r`;
    const bytes = encodeCommand(cmdWithCR);
    
    try {
      // Send command
      if (this.writeWithResponse) {
        await BleManager.write(
          this.deviceId,
          this.serviceUUID,
          this.writeCharacteristic,
          bytes
        );
      } else {
        await BleManager.writeWithoutResponse(
          this.deviceId,
          this.serviceUUID,
          this.writeCharacteristic,
          bytes
        );
      }
      
      // Set timeout
      this.timeoutId = setTimeout(() => {
        this.handleTimeout();
      }, timeoutMs);
      
      // Wait for response
      const response = await this.responsePromise!;
      return formatResponse(response, command);
    } catch (error) {
      if (error instanceof BluetoothOBDError) {
        throw error;
      }
      throw new BluetoothOBDError(
        BluetoothErrorType.WRITE_ERROR,
        `Failed to send command ${command}: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    } finally {
      this.clearResponse();
    }
  }
  
  /**
   * Process incoming notification data
   */
  public handleNotification(data: number[]): void {
    const value = decodeData(data);
    this.responseBuffer += value;
    
    // Check if response is complete
    if (isResponseComplete(this.responseBuffer) && this.responseResolver) {
      this.clearTimeout();
      this.responseResolver(this.responseBuffer);
      this.responseBuffer = '';
      this.responseResolver = null;
      this.responseRejector = null;
    }
  }
  
  /**
   * Check connection status
   */
  public isConnected(): boolean {
    return this.isConnectedFlag;
  }
  
  /**
   * Handle timeout of command
   */
  private handleTimeout(): void {
    if (this.responseRejector) {
      this.responseRejector(
        new BluetoothOBDError(
          BluetoothErrorType.TIMEOUT_ERROR,
          'Command timed out'
        )
      );
    }
    this.clearResponse();
  }
  
  /**
   * Set up a new promise for a response
   */
  private setupResponsePromise(): void {
    this.responsePromise = new Promise<string>((resolve, reject) => {
      this.responseResolver = resolve;
      this.responseRejector = reject;
    });
  }
  
  /**
   * Clear response state
   */
  private clearResponse(): void {
    this.clearTimeout();
    this.responseBuffer = '';
    this.responseResolver = null;
    this.responseRejector = null;
  }
  
  /**
   * Clear timeout if set
   */
  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Factory function to create an ECU connector
 */
export function createECUConnector(
  deviceId: string,
  serviceUUID: string,
  writeCharacteristic: string,
  notifyCharacteristic: string,
  writeWithResponse: boolean = true
): IECUConnector {
  return new BluetoothECUConnector(
    deviceId,
    serviceUUID,
    writeCharacteristic,
    notifyCharacteristic,
    writeWithResponse
  );
}
