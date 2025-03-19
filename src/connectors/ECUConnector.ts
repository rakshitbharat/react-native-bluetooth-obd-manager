import BleManager from 'react-native-ble-manager';

import { BluetoothContextValue } from '../types/bluetoothTypes';
import { decodeData, encodeCommand, formatResponse, isResponseComplete } from '../utils/dataUtils';
import { BluetoothErrorType, BluetoothOBDError } from '../utils/errorUtils';

/**
 * Interface for any ECU connector implementation
 */
export interface IECUConnector {
  sendCommand(command: string, timeoutMs?: number): Promise<string>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getDeviceId(): string | null;
}

/**
 * ECU Connector class for interacting with OBD devices
 */
export class ECUConnector implements IECUConnector {
  private deviceId: string | null = null;
  private context: BluetoothContextValue;
  private responseTimeout = 4000; // Default timeout in ms
  private isInitialized = false;

  constructor(context: BluetoothContextValue) {
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
    return this.deviceId !== null && this.context.isConnected;
  }

  /**
   * Send a command to the OBD device
   * @param command Command to send
   * @param timeoutMs Optional timeout in milliseconds
   */
  async sendCommand(command: string, timeoutMs = 5000): Promise<string> {
    if (!this.isConnected()) {
      throw new BluetoothOBDError(BluetoothErrorType.CONNECTION_ERROR, 'Device is not connected');
    }

    try {
      // Encode command (not used directly but helpful for debugging)
      encodeCommand(command);
      const response = await this.context.sendCommand(command, timeoutMs);
      return formatResponse(response, command);
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.WRITE_ERROR,
        `Failed to send command: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Disconnect from the device
   */
  async disconnect(): Promise<void> {
    if (this.deviceId) {
      try {
        await this.context.disconnect(this.deviceId);
        this.deviceId = null;
      } catch (error) {
        throw new BluetoothOBDError(
          BluetoothErrorType.DISCONNECTION_ERROR,
          `Failed to disconnect: ${error instanceof Error ? error.message : String(error)}`,
          error,
        );
      }
    }
  }

  /**
   * Reset the device (send ATZ command)
   */
  async reset(): Promise<string> {
    if (!this.isInitialized) {
      throw new BluetoothOBDError(BluetoothErrorType.CONNECTION_ERROR, 'Not initialized');
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

  public getDeviceId(): string | null {
    return this.deviceId;
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
  private isConnectedFlag = false;
  private responseBuffer = '';
  private responseCallback: ((response: string) => void) | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private responsePromise: Promise<string> | null = null;
  private responseResolver: ((value: string) => void) | null = null;
  private responseRejector: ((reason: Error) => void) | null = null;

  constructor(
    deviceId: string,
    serviceUUID: string,
    writeCharacteristic: string,
    notifyCharacteristic: string,
    writeWithResponse = true,
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
      // Check if already connected - pass an array with the service UUID
      const isConnected = await BleManager.isPeripheralConnected(this.deviceId, [this.serviceUUID]);

      if (!isConnected) {
        await BleManager.connect(this.deviceId);
        await new Promise(resolve => setTimeout(resolve, 500)); // Short delay after connection

        // After connecting, retrieve services to ensure they're properly discovered
        await BleManager.retrieveServices(this.deviceId);
      }

      // Ensure the service and characteristic exist before starting notification
      const services = await BleManager.retrieveServices(this.deviceId);

      // Check if the service and characteristic exist
      const serviceExists = services.services?.some(service => service.uuid === this.serviceUUID);
      if (!serviceExists) {
        throw new BluetoothOBDError(
          BluetoothErrorType.SERVICE_ERROR,
          `Service ${this.serviceUUID} not found on device ${this.deviceId}`,
        );
      }

      // Get all services and characteristics in one call
      const peripheralInfo = await BleManager.retrieveServices(this.deviceId);

      if (!peripheralInfo.characteristics) {
        throw new BluetoothOBDError(
          BluetoothErrorType.SERVICE_ERROR,
          `No characteristics found for device ${this.deviceId}`,
        );
      }

      // Filter characteristics for our service
      const serviceCharacteristics = peripheralInfo.characteristics.filter(
        (char: any) => char.service === this.serviceUUID || char.serviceUUID === this.serviceUUID,
      );

      const notifyCharExists = serviceCharacteristics.some(
        (char: any) =>
          char.uuid === this.notifyCharacteristic ||
          char.characteristic === this.notifyCharacteristic,
      );
      const writeCharExists = serviceCharacteristics.some(
        (char: any) =>
          char.uuid === this.writeCharacteristic ||
          char.characteristic === this.writeCharacteristic,
      );

      if (!notifyCharExists) {
        throw new BluetoothOBDError(
          BluetoothErrorType.CHARACTERISTIC_ERROR,
          `Notification characteristic ${this.notifyCharacteristic} not found in service ${this.serviceUUID}`,
        );
      }

      if (!writeCharExists) {
        throw new BluetoothOBDError(
          BluetoothErrorType.CHARACTERISTIC_ERROR,
          `Write characteristic ${this.writeCharacteristic} not found in service ${this.serviceUUID}`,
        );
      }

      // Start notification on the characteristic
      await BleManager.startNotification(
        this.deviceId,
        this.serviceUUID,
        this.notifyCharacteristic,
      );

      this.isConnectedFlag = true;
      return true;
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.CONNECTION_ERROR,
        `Failed to connect to ECU: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public isConnected(): boolean {
    return this.isConnectedFlag;
  }

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
          this.notifyCharacteristic,
        );
      } catch (e) {
        // Ignore errors in stopping notification but log them
        console.warn('Error stopping notification:', e);
      }

      // Disconnect
      await BleManager.disconnect(this.deviceId);
      this.isConnectedFlag = false;
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.DISCONNECTION_ERROR,
        `Error disconnecting from ECU: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  public async sendCommand(command: string, timeoutMs = 5000): Promise<string> {
    if (!this.isConnectedFlag) {
      throw new BluetoothOBDError(BluetoothErrorType.CONNECTION_ERROR, 'Not connected to ECU');
    }

    // Prepare for the response
    this.clearResponse();
    this.setupResponsePromise();

    // Add carriage return if needed
    const cmdWithCR = command.endsWith('\r') ? command : `${command}\r`;
    const bytes = encodeCommand(cmdWithCR);

    try {
      // Verify connection status before sending command
      const isStillConnected = await BleManager.isPeripheralConnected(this.deviceId, [
        this.serviceUUID,
      ]);
      if (!isStillConnected) {
        throw new BluetoothOBDError(
          BluetoothErrorType.CONNECTION_ERROR,
          'Device disconnected while attempting to send command',
        );
      }

      // Send command
      if (this.writeWithResponse) {
        await BleManager.write(this.deviceId, this.serviceUUID, this.writeCharacteristic, bytes);
      } else {
        await BleManager.writeWithoutResponse(
          this.deviceId,
          this.serviceUUID,
          this.writeCharacteristic,
          bytes,
        );
      }

      // Set timeout
      this.timeoutId = setTimeout(() => {
        this.handleTimeout();
      }, timeoutMs);

      // Wait for response
      if (!this.responsePromise) {
        throw new BluetoothOBDError(
          BluetoothErrorType.WRITE_ERROR,
          'Response promise not initialized',
        );
      }
      const response = await this.responsePromise;
      return formatResponse(response, command);
    } catch (error) {
      if (error instanceof BluetoothOBDError) {
        throw error;
      }
      throw new BluetoothOBDError(
        BluetoothErrorType.WRITE_ERROR,
        `Failed to send command ${command}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error,
      );
    } finally {
      this.clearResponse();
    }
  }

  /**
   * Process incoming notification data
   */
  public handleNotification(data: Uint8Array): void {
    try {
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
    } catch (error) {
      // Handle any errors in notification processing
      if (this.responseRejector) {
        this.responseRejector(
          new BluetoothOBDError(
            BluetoothErrorType.DATA_ERROR,
            `Failed to process notification data: ${
              error instanceof Error ? error.message : String(error)
            }`,
            error,
          ),
        );
      }
      this.clearResponse();
    }
  }

  /**
   * Handle timeout of command
   */
  private handleTimeout(): void {
    if (this.responseRejector) {
      this.responseRejector(
        new BluetoothOBDError(BluetoothErrorType.TIMEOUT_ERROR, 'Command timed out'),
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

  /**
   * Ensure service and characteristics exist
   */
  private async checkServiceAndCharacteristics(): Promise<boolean> {
    // Check service UUID
    if (!this.serviceUUID) {
      throw new BluetoothOBDError(BluetoothErrorType.SERVICE_ERROR, 'Missing OBD service UUID');
    }

    // First check if the device is connected
    const isConnected = await BleManager.isPeripheralConnected(this.deviceId, [this.serviceUUID]);

    if (!isConnected) {
      throw new BluetoothOBDError(BluetoothErrorType.CONNECTION_ERROR, 'Device is not connected');
    }

    try {
      // Get all services and their characteristics in one call
      const peripheralInfo = await BleManager.retrieveServices(this.deviceId);

      if (!peripheralInfo.services || !peripheralInfo.characteristics) {
        return false;
      }

      // Find our service
      const service = peripheralInfo.services.find(svc => svc.uuid === this.serviceUUID);
      if (!service) {
        return false;
      }

      // Get characteristics for our service from the full peripheral info
      const characteristics = peripheralInfo.characteristics.filter(
        char => char.serviceUUID === this.serviceUUID,
      );

      // Check if notification characteristic exists
      const notifyCharExists = characteristics.some(
        (char: any) => char.uuid === this.notifyCharacteristic,
      );

      // Check if write characteristic exists
      const writeCharExists = characteristics.some(
        (char: any) => char.uuid === this.writeCharacteristic,
      );

      return notifyCharExists && writeCharExists;
    } catch (error) {
      console.warn('Error checking characteristics:', error);
      return false;
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
  writeWithResponse = true,
): IECUConnector {
  return new BluetoothECUConnector(
    deviceId,
    serviceUUID,
    writeCharacteristic,
    notifyCharacteristic,
    writeWithResponse,
  );
}
