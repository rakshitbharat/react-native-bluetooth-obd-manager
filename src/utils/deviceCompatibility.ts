import AsyncStorage from '@react-native-async-storage/async-storage';
import { Peripheral } from 'react-native-ble-manager';

import { ConnectionDetails } from '../types/bluetoothTypes';

const STORAGE_KEY = '@OBDManager:deviceHistory';

interface DeviceProfile {
  id: string;
  name: string;
  serviceUUID: string;
  writeCharacteristic: string;
  notifyCharacteristic: string;
  writeWithResponse: boolean;
  lastConnected: number;
  successCount: number;
  isOBDDevice: boolean;
  manufacturer?: string;
  model?: string;
}

class DeviceCompatibilityManager {
  private static instance: DeviceCompatibilityManager;
  private deviceHistory: Map<string, DeviceProfile> = new Map();
  private isLoaded = false;

  /**
   * Private constructor for singleton pattern.
   * Data loading is deferred until loadDeviceHistory is called.
   */
  private constructor() {
    // Intentionally empty - initialization happens through loadDeviceHistory
  }

  static getInstance(): DeviceCompatibilityManager {
    if (!DeviceCompatibilityManager.instance) {
      DeviceCompatibilityManager.instance = new DeviceCompatibilityManager();
    }
    return DeviceCompatibilityManager.instance;
  }

  async loadDeviceHistory(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const historyJson = await AsyncStorage.getItem(STORAGE_KEY);
      if (historyJson) {
        const history = JSON.parse(historyJson);
        this.deviceHistory = new Map(Object.entries(history));
      }
      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load device history:', error);
    }
  }

  private async saveDeviceHistory(): Promise<void> {
    try {
      const historyObject = Object.fromEntries(this.deviceHistory);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(historyObject));
    } catch (error) {
      console.error('Failed to save device history:', error);
    }
  }

  async recordSuccessfulConnection(
    deviceId: string,
    deviceName: string,
    connectionDetails: ConnectionDetails,
    isOBDDevice = true,
  ): Promise<void> {
    await this.loadDeviceHistory();

    const profile: DeviceProfile = this.deviceHistory.get(deviceId) || {
      id: deviceId,
      name: deviceName,
      serviceUUID: '',
      writeCharacteristic: '',
      notifyCharacteristic: '',
      writeWithResponse: false,
      lastConnected: 0,
      successCount: 0,
      isOBDDevice: isOBDDevice,
    };

    profile.serviceUUID = connectionDetails.serviceUUID;
    profile.writeCharacteristic =
      connectionDetails.writeCharacteristicUUID || connectionDetails.characteristicUUID;
    profile.notifyCharacteristic =
      connectionDetails.notifyCharacteristicUUID || connectionDetails.characteristicUUID;
    profile.writeWithResponse = connectionDetails.writeWithResponse;
    profile.lastConnected = Date.now();
    profile.successCount++;
    profile.isOBDDevice = isOBDDevice;

    this.deviceHistory.set(deviceId, profile);
    await this.saveDeviceHistory();
  }

  async getKnownConnectionDetails(deviceId: string): Promise<ConnectionDetails | null> {
    await this.loadDeviceHistory();

    const profile = this.deviceHistory.get(deviceId);
    if (!profile) return null;

    return {
      serviceUUID: profile.serviceUUID,
      characteristicUUID: profile.notifyCharacteristic,
      writeCharacteristicUUID: profile.writeCharacteristic,
      notifyCharacteristicUUID: profile.notifyCharacteristic,
      writeWithResponse: profile.writeWithResponse,
    };
  }

  async getRecentDevices(limit = 5, obdOnly = true): Promise<DeviceProfile[]> {
    await this.loadDeviceHistory();

    let devices = Array.from(this.deviceHistory.values());

    // Filter for OBD devices if needed
    if (obdOnly) {
      devices = devices.filter(device => device.isOBDDevice);
    }

    // Sort by last connection time (most recent first)
    return devices.sort((a, b) => b.lastConnected - a.lastConnected).slice(0, limit);
  }

  async getMostUsedDevices(limit = 5, obdOnly = true): Promise<DeviceProfile[]> {
    await this.loadDeviceHistory();

    let devices = Array.from(this.deviceHistory.values());

    // Filter for OBD devices if needed
    if (obdOnly) {
      devices = devices.filter(device => device.isOBDDevice);
    }

    // Sort by success count (most used first)
    return devices.sort((a, b) => b.successCount - a.successCount).slice(0, limit);
  }

  async updateDeviceInfo(deviceId: string, info: Partial<DeviceProfile>): Promise<void> {
    await this.loadDeviceHistory();

    const profile = this.deviceHistory.get(deviceId);
    if (!profile) return;

    this.deviceHistory.set(deviceId, { ...profile, ...info });
    await this.saveDeviceHistory();
  }

  async isKnownOBDDevice(deviceId: string): Promise<boolean> {
    await this.loadDeviceHistory();
    const profile = this.deviceHistory.get(deviceId);
    return !!profile && profile.isOBDDevice;
  }

  async clearDeviceHistory(): Promise<void> {
    this.deviceHistory.clear();
    await this.saveDeviceHistory();
  }

  async removeDevice(deviceId: string): Promise<void> {
    await this.loadDeviceHistory();
    this.deviceHistory.delete(deviceId);
    await this.saveDeviceHistory();
  }
}

export default DeviceCompatibilityManager.getInstance();

// Common keywords found in OBD device names
export const OBD_KEYWORDS = [
  'obd',
  'elm',
  'elm327',
  'obdii',
  'eobd',
  'car',
  'scanner',
  'vgate',
  'interface',
  'bluetooth',
  'odbii',
  'diagnostic',
  'adapter',
  'reader',
  'scan',
  'auto',
  'automotive',
  'v1.5',
  'v2.1',
];

// Keywords commonly found in non-OBD Bluetooth devices
export const NON_OBD_KEYWORDS = [
  'speaker',
  'headphone',
  'audio',
  'watch',
  'tv',
  'home',
  'pc',
  'phone',
  'fitness',
  'printer',
  'camera',
  'keyboard',
  'mouse',
  'game',
  'controller',
  'remote',
  'earphone',
  'airpods',
  'headset',
  'bud',
  'tag',
  'tracker',
];

/**
 * Check if a device is likely to be an OBD device based on its name
 * @param device Bluetooth peripheral device
 * @returns True if the device is likely an OBD adapter
 */
export function isOBDDevice(device: Peripheral): boolean {
  if (!device) return false;

  const deviceName = (device.name || device.advertising?.localName || '').toLowerCase();
  if (!deviceName) return false;

  // If it contains OBD keywords, it's likely an OBD device
  for (const keyword of OBD_KEYWORDS) {
    if (deviceName.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  // If it contains non-OBD keywords, it's likely not an OBD device
  for (const keyword of NON_OBD_KEYWORDS) {
    if (deviceName.includes(keyword.toLowerCase())) {
      return false;
    }
  }

  // If the device has a MAC address format typical of OBD devices
  // Many ELM327 devices have specific MAC patterns
  if (
    device.id &&
    (device.id.startsWith('00:0D:18:') || // Common ELM327 prefix
      device.id.startsWith('00:1D:A5:') || // Another common prefix
      device.id.startsWith('AC:D1:B8:')) // Chinese ELM327 clone prefix
  ) {
    return true;
  }

  // Default to unknown
  return false;
}

/**
 * Get common ELM327 service and characteristics for a device
 * based on historical data or common profiles
 */
export function getCommonELM327Profile(deviceId: string): ConnectionDetails | null {
  // Common service/characteristic profiles for OBD devices
  const commonProfiles: ConnectionDetails[] = [
    // Standard ELM327 profile
    {
      serviceUUID: 'FFF0',
      characteristicUUID: 'FFF1',
      writeCharacteristicUUID: 'FFF1',
      notifyCharacteristicUUID: 'FFF1',
      writeWithResponse: true,
    },
    // Alternative profile seen in some adapters
    {
      serviceUUID: 'FFE0',
      characteristicUUID: 'FFE1',
      writeCharacteristicUUID: 'FFE1',
      notifyCharacteristicUUID: 'FFE1',
      writeWithResponse: false,
    },
    // Yet another profile for Chinese clones
    {
      serviceUUID: 'E7A1',
      characteristicUUID: 'E7A1',
      writeCharacteristicUUID: 'E7A1',
      notifyCharacteristicUUID: 'E7A1',
      writeWithResponse: true,
    },
  ];

  // Check if this device ID matches known patterns
  if (deviceId.startsWith('00:0D:18:')) {
    return commonProfiles[0]; // Standard ELM327
  }

  if (deviceId.startsWith('00:1D:A5:')) {
    return commonProfiles[1]; // Alternative profile
  }

  if (deviceId.startsWith('AC:D1:B8:')) {
    return commonProfiles[2]; // Chinese clone profile
  }

  // Default to most common profile
  return commonProfiles[0];
}
