import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import BleManager, { Peripheral, Service, Characteristic } from 'react-native-ble-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BluetoothDeviceInfo, ConnectionDetails, ScanOptions } from '../types/bluetoothTypes';
import { BluetoothOBDError, BluetoothErrorType } from '../utils/errorUtils';

// BLE Manager emitter for event handling
const bleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(bleManagerModule);

// Default device manager configuration
const DEFAULT_CONFIG = {
  scanTimeout: 10000,
  connectionTimeout: 10000,
  autoConnect: true,
  showPowerAlert: true,
};

// Storage key for known devices
const STORAGE_KEY_KNOWN_DEVICES = '@DeviceManager:knownDevices';

/**
 * Known device record for storage
 */
interface KnownDevice {
  id: string;
  name: string;
  lastConnected: number; // Timestamp
  isOBDDevice: boolean;
}

/**
 * Device Manager configuration options
 */
export interface DeviceManagerConfig {
  scanTimeout?: number;
  connectionTimeout?: number;
  autoConnect?: boolean;
  showPowerAlert?: boolean;
}

/**
 * Device Manager handles Bluetooth device discovery,
 * connection, and management. It's implemented as a
 * singleton to ensure a single consistent source of
 * device management.
 */
export class DeviceManager {
  private static instance: DeviceManager;
  private knownDevices: KnownDevice[] = [];
  private lastConnectedDevice: string | null = null;
  private initialized: boolean = false;
  private config: DeviceManagerConfig;
  private scanListener?: ReturnType<typeof bleManagerEmitter.addListener>;
  private connectListener?: ReturnType<typeof bleManagerEmitter.addListener>;
  private disconnectListener?: ReturnType<typeof bleManagerEmitter.addListener>;

  private constructor(config: DeviceManagerConfig = DEFAULT_CONFIG) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.loadFromStorage().catch(e => console.error('Failed to load device storage:', e));
  }

  /**
   * Get the singleton instance of DeviceManager
   */
  public static getInstance(config?: DeviceManagerConfig): DeviceManager {
    if (!DeviceManager.instance) {
      DeviceManager.instance = new DeviceManager(config);
    }
    return DeviceManager.instance;
  }

  /**
   * Initialize Bluetooth functionality
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await BleManager.start({ showAlert: this.config.showPowerAlert });
      this.setupEventListeners();
      this.initialized = true;
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.INITIALIZATION_ERROR,
        `Failed to initialize Bluetooth: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Setup event listeners for Bluetooth events
   */
  private setupEventListeners(): void {
    // Clear any existing listeners
    if (this.scanListener) this.scanListener.remove();
    if (this.connectListener) this.connectListener.remove();
    if (this.disconnectListener) this.disconnectListener.remove();

    // Set up new listeners
    this.scanListener = bleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      this.handleDiscoverPeripheral.bind(this),
    );

    this.connectListener = bleManagerEmitter.addListener(
      'BleManagerConnectPeripheral',
      this.handleConnectPeripheral.bind(this),
    );

    this.disconnectListener = bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      this.handleDisconnectPeripheral.bind(this),
    );
  }

  /**
   * Handle discovered peripheral
   */
  private handleDiscoverPeripheral(peripheral: Peripheral): void {
    // Handle peripheral discovery (can be implemented as needed)
    console.log('Discovered peripheral:', peripheral.id, peripheral.name);
  }

  /**
   * Handle peripheral connect event
   */
  private handleConnectPeripheral(peripheral: { peripheral: string }): void {
    // Handle peripheral connected
    console.log('Connected to peripheral:', peripheral.peripheral);
  }

  /**
   * Handle peripheral disconnect event
   */
  private handleDisconnectPeripheral(peripheral: { peripheral: string }): void {
    // Handle peripheral disconnected
    console.log('Disconnected from peripheral:', peripheral.peripheral);
  }

  /**
   * Start scanning for Bluetooth devices
   */
  async startScan(options?: ScanOptions): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Stop any ongoing scan
      await this.stopScan();

      // Default scan options
      const scanOptions = {
        duration: options?.duration || this.config.scanTimeout || 10000,
        allowDuplicates: options?.allowDuplicates || false,
      };

      // Start scan with empty UUID array (scan for all devices)
      await BleManager.scan([], scanOptions.duration / 1000, scanOptions.allowDuplicates);

      // Auto-stop after duration
      setTimeout(() => {
        this.stopScan().catch(e => console.error('Error stopping scan:', e));
      }, scanOptions.duration);
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.SCAN_ERROR,
        `Failed to start scan: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Stop scanning for Bluetooth devices
   */
  async stopScan(): Promise<void> {
    try {
      await BleManager.stopScan();
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.SCAN_ERROR,
        `Failed to stop scan: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Connect to a Bluetooth device and retrieve its details
   */
  async connectToDevice(deviceId: string): Promise<ConnectionDetails> {
    try {
      await BleManager.connect(deviceId);
      const peripheral = await BleManager.retrieveServices(deviceId);

      if (!peripheral.services?.length) {
        throw new BluetoothOBDError(
          BluetoothErrorType.SERVICE_ERROR,
          'No services found on device',
        );
      }

      // Find the first available service and characteristic for writing
      const service = peripheral.services[0];
      const characteristics = await BleManager.retrieveCharacteristics(deviceId, service.uuid);

      const writableCharacteristic = characteristics.find(
        (c: Characteristic) => c.properties.Write || c.properties.WriteWithoutResponse,
      );

      if (!writableCharacteristic) {
        throw new BluetoothOBDError(
          BluetoothErrorType.CHARACTERISTIC_ERROR,
          'No writable characteristic found',
        );
      }

      // Save as last connected device
      await this.setLastConnectedDevice(deviceId);

      return {
        serviceUUID: service.uuid,
        characteristicUUID: writableCharacteristic.uuid,
        writeWithResponse: writableCharacteristic.properties.Write || false,
        mtu: undefined, // Optional MTU size
      };
    } catch (error) {
      if (error instanceof BluetoothOBDError) {
        throw error;
      }
      throw new BluetoothOBDError(
        BluetoothErrorType.CONNECTION_ERROR,
        `Failed to connect to device: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Disconnect from a Bluetooth device
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    try {
      await BleManager.disconnect(deviceId);
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.DISCONNECTION_ERROR,
        `Failed to disconnect from device: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error,
      );
    }
  }

  /**
   * Write data to a Bluetooth characteristic
   */
  async writeCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    value: number[],
    writeWithResponse: boolean = true,
  ): Promise<void> {
    try {
      if (writeWithResponse) {
        await BleManager.write(deviceId, serviceUUID, characteristicUUID, value);
      } else {
        await BleManager.writeWithoutResponse(deviceId, serviceUUID, characteristicUUID, value);
      }
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.WRITE_ERROR,
        `Failed to write to characteristic: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error,
      );
    }
  }

  /**
   * Read data from a Bluetooth characteristic
   */
  async readCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
  ): Promise<number[]> {
    try {
      return await BleManager.read(deviceId, serviceUUID, characteristicUUID);
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.READ_ERROR,
        `Failed to read from characteristic: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error,
      );
    }
  }

  /**
   * Start notifications for a Bluetooth characteristic
   */
  async startNotifications(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
  ): Promise<void> {
    try {
      await BleManager.startNotification(deviceId, serviceUUID, characteristicUUID);
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.NOTIFICATION_ERROR,
        `Failed to start notifications: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Stop notifications for a Bluetooth characteristic
   */
  async stopNotifications(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
  ): Promise<void> {
    try {
      await BleManager.stopNotification(deviceId, serviceUUID, characteristicUUID);
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.NOTIFICATION_ERROR,
        `Failed to stop notifications: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Destroy manager instance and clean up resources
   */
  destroy(): void {
    if (this.scanListener) this.scanListener.remove();
    if (this.connectListener) this.connectListener.remove();
    if (this.disconnectListener) this.disconnectListener.remove();
    this.initialized = false;

    // Reset the singleton instance
    DeviceManager.instance = undefined as any;
  }

  /**
   * Load known devices from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const storedData = await AsyncStorage.getItem(STORAGE_KEY_KNOWN_DEVICES);
      if (storedData) {
        const parsedData = JSON.parse(storedData);

        if (Array.isArray(parsedData.devices)) {
          this.knownDevices = parsedData.devices;
        }

        if (typeof parsedData.lastConnected === 'string') {
          this.lastConnectedDevice = parsedData.lastConnected;
        }
      }
    } catch (error) {
      console.error('Error loading device data from storage:', error);
      // Initialize with empty data on error
      this.knownDevices = [];
      this.lastConnectedDevice = null;
    }
  }

  /**
   * Save known devices to storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      const dataToStore = {
        devices: this.knownDevices,
        lastConnected: this.lastConnectedDevice,
      };

      await AsyncStorage.setItem(STORAGE_KEY_KNOWN_DEVICES, JSON.stringify(dataToStore));
    } catch (error) {
      console.error('Error saving device data to storage:', error);
    }
  }

  /**
   * Remember a device for future connections
   */
  public async rememberDevice(device: Peripheral, isOBDDevice = true): Promise<void> {
    // Don't remember devices without IDs
    if (!device.id) return;

    const deviceName = device.name || `Device ${device.id.substring(0, 6)}`;

    // Check if device already exists in known devices
    const existingIndex = this.knownDevices.findIndex(d => d.id === device.id);

    if (existingIndex >= 0) {
      // Update existing device
      this.knownDevices[existingIndex] = {
        ...this.knownDevices[existingIndex],
        name: deviceName, // Update name in case it changed
        lastConnected: Date.now(),
        isOBDDevice,
      };
    } else {
      // Add new device
      this.knownDevices.push({
        id: device.id,
        name: deviceName,
        lastConnected: Date.now(),
        isOBDDevice,
      });
    }

    // Sort by most recently connected
    this.knownDevices.sort((a, b) => b.lastConnected - a.lastConnected);

    // Save changes
    await this.saveToStorage();
  }

  /**
   * Set the last connected device
   */
  public async setLastConnectedDevice(deviceId: string): Promise<void> {
    this.lastConnectedDevice = deviceId;
    await this.saveToStorage();
  }

  /**
   * Get the last connected device ID
   */
  public getLastConnectedDevice(): string | null {
    return this.lastConnectedDevice;
  }

  /**
   * Get all known devices
   */
  public getKnownDevices(): KnownDevice[] {
    return [...this.knownDevices];
  }

  /**
   * Get known OBD devices only
   */
  public getKnownOBDDevices(): KnownDevice[] {
    return this.knownDevices.filter(device => device.isOBDDevice);
  }

  /**
   * Forget a specific device
   */
  public async forgetDevice(deviceId: string): Promise<void> {
    this.knownDevices = this.knownDevices.filter(device => device.id !== deviceId);

    // If this was the last connected device, clear that too
    if (this.lastConnectedDevice === deviceId) {
      this.lastConnectedDevice = null;
    }

    await this.saveToStorage();
  }

  /**
   * Forget all devices
   */
  public async forgetAllDevices(): Promise<void> {
    this.knownDevices = [];
    this.lastConnectedDevice = null;
    await this.saveToStorage();
  }

  /**
   * Check if a device is in the known devices list
   */
  public isKnownDevice(deviceId: string): boolean {
    return this.knownDevices.some(device => device.id === deviceId);
  }

  /**
   * Get a known device by ID
   */
  public getDeviceById(deviceId: string): KnownDevice | null {
    return this.knownDevices.find(device => device.id === deviceId) || null;
  }
}

export default DeviceManager.getInstance();
