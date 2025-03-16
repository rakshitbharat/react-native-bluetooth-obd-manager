import { Peripheral } from 'react-native-ble-manager';
import { ConnectionDetails } from '../types/bluetoothTypes';
import { AsyncStorage } from 'react-native';

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

/**
 * Manager for handling Bluetooth device history and preferences
 */
export class DeviceManager {
  private static instance: DeviceManager;
  private knownDevices: KnownDevice[] = [];
  private lastConnectedDevice: string | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): DeviceManager {
    if (!DeviceManager.instance) {
      DeviceManager.instance = new DeviceManager();
      DeviceManager.instance.loadFromStorage();
    }
    return DeviceManager.instance;
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
  public async rememberDevice(device: Peripheral, isOBDDevice: boolean = true): Promise<void> {
    const existingIndex = this.knownDevices.findIndex(d => d.id === device.id);
    
    if (existingIndex >= 0) {
      // Update existing device
      this.knownDevices[existingIndex] = {
        id: device.id,
        name: device.name || 'Unknown Device',
        lastConnected: Date.now(),
        isOBDDevice
      };
    } else {
      // Add new device
      this.knownDevices.push({
        id: device.id,
        name: device.name || 'Unknown Device',
        lastConnected: Date.now(),
        isOBDDevice
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
