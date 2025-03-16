import { Peripheral } from 'react-native-ble-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
}

class DeviceCompatibilityManager {
  private static instance: DeviceCompatibilityManager;
  private deviceHistory: Map<string, DeviceProfile> = new Map();
  private isLoaded = false;

  private constructor() {}

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
  ): Promise<void> {
    await this.loadDeviceHistory();

    const profile = this.deviceHistory.get(deviceId) || {
      id: deviceId,
      name: deviceName,
      successCount: 0,
    };

    profile.serviceUUID = connectionDetails.serviceUUID;
    profile.writeCharacteristic = connectionDetails.writeCharacteristicUUID;
    profile.notifyCharacteristic = connectionDetails.notifyCharacteristicUUID;
    profile.writeWithResponse = connectionDetails.writeWithResponse;
    profile.lastConnected = Date.now();
    profile.successCount++;

    this.deviceHistory.set(deviceId, profile);
    await this.saveDeviceHistory();
  }

  async getKnownConnectionDetails(deviceId: string): Promise<ConnectionDetails | null> {
    await this.loadDeviceHistory();

    const profile = this.deviceHistory.get(deviceId);
    if (!profile) return null;

    return {
      serviceUUID: profile.serviceUUID,
      writeCharacteristicUUID: profile.writeCharacteristic,
      notifyCharacteristicUUID: profile.notifyCharacteristic,
      writeWithResponse: profile.writeWithResponse,
    };
  }

  async getRecentDevices(limit: number = 5): Promise<DeviceProfile[]> {
    await this.loadDeviceHistory();

    return Array.from(this.deviceHistory.values())
      .sort((a, b) => b.lastConnected - a.lastConnected)
      .slice(0, limit);
  }

  async clearDeviceHistory(): Promise<void> {
    this.deviceHistory.clear();
    await this.saveDeviceHistory();
  }
}

export default DeviceCompatibilityManager.getInstance();

// Common keywords found in OBD device names
const OBD_KEYWORDS = [
  'obd',
  'elm',
  'elm327',
  'obdii',
  'eobd',
  'car',
  'scanner',
  'vgate',
  'interface',
];

// Keywords commonly found in non-OBD Bluetooth devices
const NON_OBD_KEYWORDS = [
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
];

/**
 * Check if a device is likely to be an OBD device based on its name
 * @param device Bluetooth peripheral device
 * @returns True if the device is likely an OBD adapter
 */
export const isLikelyOBDDevice = (device: Peripheral): boolean => {
  if (!device.name) return false;

  const name = device.name.toLowerCase();

  // Check if name contains any OBD-related keywords
  const hasOBDKeyword = OBD_KEYWORDS.some(keyword => name.includes(keyword));
  if (hasOBDKeyword) return true;

  // Exclude devices with common non-OBD keywords
  const hasNonOBDKeyword = NON_OBD_KEYWORDS.some(keyword => name.includes(keyword));
  if (hasNonOBDKeyword) return false;

  // Check for common OBD device address prefixes
  if (device.id && typeof device.id === 'string') {
    // Some common OBD device address prefixes (not exhaustive)
    const knownPrefixes = ['00:0D:18', '00:1D:A5', '00:04:3E'];
    for (const prefix of knownPrefixes) {
      if (device.id.toUpperCase().startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Return compatibility score for a device (0-100)
 * Higher score means more likely to be compatible
 */
export const getOBDCompatibilityScore = (device: Peripheral): number => {
  if (!device.name) return 0;

  let score = 0;
  const name = device.name.toLowerCase();

  // Score based on device name
  OBD_KEYWORDS.forEach(keyword => {
    if (name.includes(keyword)) {
      score += 20;
    }
  });

  // Reduce score for non-OBD keywords
  NON_OBD_KEYWORDS.forEach(keyword => {
    if (name.includes(keyword)) {
      score -= 15;
    }
  });

  // Additional points for specific identifiers
  if (name.includes('elm327')) score += 30;
  if (name.includes('obdii')) score += 25;
  if (name.includes('scanner')) score += 10;

  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, score));
};

/**
 * Sort devices by their OBD compatibility
 * Most compatible devices come first
 */
export const sortDevicesByCompatibility = (devices: Peripheral[]): Peripheral[] => {
  return [...devices].sort((a, b) => {
    const scoreA = getOBDCompatibilityScore(a);
    const scoreB = getOBDCompatibilityScore(b);
    return scoreB - scoreA;
  });
};
