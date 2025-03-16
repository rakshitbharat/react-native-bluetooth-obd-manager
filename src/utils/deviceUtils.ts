import { Platform } from 'react-native';
import BleManager from 'react-native-ble-manager';

import { ConnectionDetails } from '../types/bluetoothTypes';

// Common ELM327 service UUIDs
const COMMON_OBD_SERVICES = [
  'FFE0', // Most common ELM327 service
  'FFF0', // Alternative service
  '18F0', // Used by some older adapters
  'BEEF', // Used by some Chinese adapters
  'E7A1', // Another variant
  'FFE1', // Some Chinese clones
  'FFF1', // Another clone variant
  'FF00', // Generic OBD service
];

// Common characteristic UUIDs for old adapters
const COMMON_CHARACTERISTICS = [
  'FFE1', // Most common
  'FFF1', // Alternative
  'FF01', // Generic
  'E7A1', // Some older adapters
];

// Convert short UUID to full format for iOS
const getFullUUID = (shortUUID: string): string => {
  return `0000${shortUUID}-0000-1000-8000-00805F9B34FB`.toUpperCase();
};

/**
 * Find compatible service and characteristic for an OBD device
 * @param device Device information from BleManager
 * @returns Connection details or null if not found
 */
export const findServiceAndCharacteristic = async (device: any): Promise<ConnectionDetails | null> => {
  try {
    if (!device || !device.services || !device.characteristics) {
      return null;
    }

    // Find a compatible service
    const service = device.services.find((s: any) => {
      const serviceUUID = s.uuid.toUpperCase();
      return COMMON_OBD_SERVICES.some(id => serviceUUID.includes(id));
    });

    if (!service) {
      return null;
    }

    // Get all characteristics for this service
    const serviceChars = device.characteristics.filter(
      (c: any) => c.service.toUpperCase() === service.uuid.toUpperCase(),
    );

    // Find notify characteristic
    const notifyChar = serviceChars.find((c: any) => {
      return c.properties?.Notify === 'Notify';
    });

    if (!notifyChar) {
      return null;
    }

    // Find write characteristic (may be the same as notify)
    let writeChar = serviceChars.find((c: any) => {
      return c.properties?.WriteWithoutResponse === 'WriteWithoutResponse';
    });

    // If no write without response, try regular write
    let writeWithResponse = false;
    if (!writeChar) {
      writeChar = serviceChars.find((c: any) => {
        return c.properties?.Write === 'Write';
      });
      writeWithResponse = true;
    }

    // If still no write characteristic, try using the notify characteristic
    if (!writeChar) {
      writeChar = notifyChar;
      writeWithResponse = true;
    }

    return {
      serviceUUID: service.uuid,
      writeCharacteristicUUID: writeChar.characteristic,
      notifyCharacteristicUUID: notifyChar.characteristic,
      writeWithResponse,
    };
  } catch (error) {
    console.error('Error finding service/characteristic:', error);
    return null;
  }
};

/**
 * Check if a device is likely an OBD device based on name
 */
export const isOBDDevice = (device: any): boolean => {
  if (!device || !device.name) return false;

  const keywords = ['obd', 'elm', 'elm327', 'obdii', 'eobd', 'car', 'scanner', 'vgate'];
  const deviceName = device.name.toLowerCase();
  
  return keywords.some(keyword => deviceName.includes(keyword));
};

/**
 * Get a friendly name for the device
 */
export const getDeviceName = (device: any): string => {
  if (!device) return 'Unknown Device';
  
  if (device.name) {
    return device.name;
  } else if (device.id) {
    return `Device (${device.id})`;
  }
  
  return 'Unknown Device';
};

// Other utility functions...
