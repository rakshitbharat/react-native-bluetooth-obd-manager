import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import BleManager, { Peripheral, Service, Characteristic } from 'react-native-ble-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BluetoothDeviceInfo, ConnectionDetails, ScanOptions } from '../types/bluetoothTypes';
import { BluetoothOBDError, BluetoothErrorType } from '../utils/errorUtils';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

// Storage keys
const STORAGE_KEYS = {
  LAST_DEVICE: '@OBDManager:lastDevice',
  KNOWN_DEVICES: '@OBDManager:knownDevices',
};

// Maximum number of known devices to remember
const MAX_KNOWN_DEVICES = 10;

interface KnownDevice {
  id: string;
  name: string;
  lastConnected: number; // Timestamp
  isOBDDevice: boolean;
}

export interface DeviceManagerConfig {
  scanTimeout?: number;
  connectionTimeout?: number;
  autoConnect?: boolean;
  showPowerAlert?: boolean;
}

const DEFAULT_CONFIG: DeviceManagerConfig = {
  scanTimeout: 10000,
  connectionTimeout: 5000,
  autoConnect: false,
  showPowerAlert: true
};

/**
 * Manager for handling Bluetooth device history and preferences
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
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(config?: DeviceManagerConfig): DeviceManager {
    if (!DeviceManager.instance) {
      DeviceManager.instance = new DeviceManager(config);
      DeviceManager.instance.loadFromStorage();
    }
    return DeviceManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await BleManager.start({ showAlert: this.config.showPowerAlert });
      this.setupEventListeners();
      this.initialized = true;
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.INITIALIZATION_ERROR,
        `Failed to initialize BLE Manager: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private setupEventListeners(): void {
    // Scan event listener
    this.scanListener = bleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      this.handleDiscoverPeripheral.bind(this)
    );

    // Connection event listeners
    this.connectListener = bleManagerEmitter.addListener(
      'BleManagerConnectPeripheral',
      this.handleConnectPeripheral.bind(this)
    );

    this.disconnectListener = bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      this.handleDisconnectPeripheral.bind(this)
    );
  }

  private handleDiscoverPeripheral(peripheral: Peripheral): void {
    // Handle discovered peripheral
    // This method can be extended based on requirements
  }

  private handleConnectPeripheral(peripheral: { peripheral: string }): void {
    // Handle connected peripheral
    // This method can be extended based on requirements
  }

  private handleDisconnectPeripheral(peripheral: { peripheral: string }): void {
    // Handle disconnected peripheral
    // This method can be extended based on requirements
  }

  async startScan(options?: ScanOptions): Promise<void> {
    if (!this.initialized) {
      throw new BluetoothOBDError(
        BluetoothErrorType.INITIALIZATION_ERROR,
        'Device manager not initialized'
      );
    }
    try {
      // Ensure we always pass a number for the duration parameter
      const duration = options?.duration || this.config.scanTimeout || DEFAULT_CONFIG.scanTimeout || 10000;
      await BleManager.scan([], 
        duration,
        options?.allowDuplicates ?? false
      );
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.SCAN_ERROR,
        `Failed to start scan: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async stopScan(): Promise<void> {
    try {
      await BleManager.stopScan();
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.SCAN_ERROR,
        `Failed to stop scan: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async connectToDevice(deviceId: string): Promise<ConnectionDetails> {
    if (!deviceId) {
      throw new BluetoothOBDError(
        BluetoothErrorType.INVALID_PARAMETER,
        'Device ID is required'
      );
    }

    try {
      await BleManager.connect(deviceId);
      const peripheral = await BleManager.retrieveServices(deviceId);

      if (!peripheral.services?.length) {
        throw new BluetoothOBDError(
          BluetoothErrorType.SERVICE_ERROR,
          'No services found on device'
        );
      }

      // Find the first available service and characteristic for writing
      const service = peripheral.services[0];
      const characteristics = await BleManager.retrieveCharacteristics(
        deviceId,
        service.uuid
      );

      const writableCharacteristic = characteristics.find(
        (c: Characteristic) => c.properties.Write || c.properties.WriteWithoutResponse
      );

      if (!writableCharacteristic) {
        throw new BluetoothOBDError(
          BluetoothErrorType.CHARACTERISTIC_ERROR,
          'No writable characteristic found'
        );
      }

      return {
        serviceUUID: service.uuid,
        characteristicUUID: writableCharacteristic.uuid,
        writeWithResponse: writableCharacteristic.properties.Write || false,
        mtu: undefined // Optional MTU size
      };
    } catch (error) {
      if (error instanceof BluetoothOBDError) {
        throw error;
      }
      throw new BluetoothOBDError(
        BluetoothErrorType.CONNECTION_ERROR,
        `Failed to connect to device: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    try {
      await BleManager.disconnect(deviceId);
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.DISCONNECTION_ERROR,
        `Failed to disconnect device: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async writeCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    value: number[],
    writeWithResponse: boolean = true
  ): Promise<void> {
    try {
      await BleManager.write(
        deviceId,
        serviceUUID,
        characteristicUUID,
        value,
        writeWithResponse ? 1 : 0 // Convert boolean to number as required by BleManager
      );
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.WRITE_ERROR,
        `Failed to write characteristic: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async readCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<number[]> {
    try {
      return await BleManager.read(deviceId, serviceUUID, characteristicUUID);
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.READ_ERROR,
        `Failed to read characteristic: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async startNotifications(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<void> {
    try {
      await BleManager.startNotification(deviceId, serviceUUID, characteristicUUID);
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.NOTIFICATION_ERROR,
        `Failed to start notifications: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async stopNotifications(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<void> {
    try {
      await BleManager.stopNotification(deviceId, serviceUUID, characteristicUUID);
    } catch (error) {
      throw new BluetoothOBDError(
        BluetoothErrorType.NOTIFICATION_ERROR,
        `Failed to stop notifications: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  destroy(): void {
    this.scanListener?.remove();
    this.connectListener?.remove();
    this.disconnectListener?.remove();
    this.initialized = false;
  }

  /**
   * Load saved devices from persistent storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      // Load last connected device
      const lastDeviceId = await AsyncStorage.getItem(STORAGE_KEYS.LAST_DEVICE);
      if (lastDeviceId) {
        this.lastConnectedDevice = lastDeviceId;
      }

      // Load known devices
      const knownDevicesJson = await AsyncStorage.getItem(STORAGE_KEYS.KNOWN_DEVICES);
      if (knownDevicesJson) {
        this.knownDevices = JSON.parse(knownDevicesJson);
      }
    } catch (error) {
      console.error('Failed to load device data from storage:', error);
    }
  }

  /**
   * Save current device data to persistent storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      // Save last connected device
      if (this.lastConnectedDevice) {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_DEVICE, this.lastConnectedDevice);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.LAST_DEVICE);
      }

      // Save known devices
      await AsyncStorage.setItem(STORAGE_KEYS.KNOWN_DEVICES, JSON.stringify(this.knownDevices));
    } catch (error) {
      console.error('Failed to save device data to storage:', error);
    }
  }

  /**
   * Remember a device that has been connected to
   */
  public async rememberDevice(device: Peripheral, isOBDDevice = true): Promise<void> {
    const existingIndex = this.knownDevices.findIndex(d => d.id === device.id);

    if (existingIndex >= 0) {
      // Update existing device
      this.knownDevices[existingIndex] = {
        id: device.id,
        name: device.name || 'Unknown Device',
        lastConnected: Date.now(),
        isOBDDevice,
      };
    } else {
      // Add new device
      this.knownDevices.push({
        id: device.id,
        name: device.name || 'Unknown Device',
        lastConnected: Date.now(),
        isOBDDevice,
      });

      // Maintain maximum list size
      if (this.knownDevices.length > MAX_KNOWN_DEVICES) {
        // Sort by last connected time (newest first)
        this.knownDevices.sort((a, b) => b.lastConnected - a.lastConnected);
        // Keep only the most recent MAX_KNOWN_DEVICES
        this.knownDevices = this.knownDevices.slice(0, MAX_KNOWN_DEVICES);
      }
    }

    // Save to storage
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
   * Check if a device is known
   */
  public isKnownDevice(deviceId: string): boolean {
    return this.knownDevices.some(device => device.id === deviceId);
  }

  /**
   * Get device info by ID
   */
  public getDeviceById(deviceId: string): KnownDevice | null {
    const device = this.knownDevices.find(d => d.id === deviceId);
    return device || null;
  }
}

export default DeviceManager.getInstance();
