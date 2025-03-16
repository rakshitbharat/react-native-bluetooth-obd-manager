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

// Normalize UUID format based on platform
const normalizeUUID = (uuid: string): string => {
  uuid = uuid.toUpperCase();
  if (Platform.OS === 'ios' && uuid.length === 4) {
    return getFullUUID(uuid);
  }
  return uuid;
};

// Check if a UUID matches any common OBD service
const isOBDService = (uuid: string): boolean => {
  const normalized = normalizeUUID(uuid);
  return COMMON_OBD_SERVICES.some(service => {
    const normalizedService = normalizeUUID(service);
    return normalized === normalizedService;
  });
};

// Check if a characteristic UUID matches common OBD characteristics
const isOBDCharacteristic = (uuid: string): boolean => {
  const normalized = normalizeUUID(uuid);
  return COMMON_CHARACTERISTICS.some(char => {
    const normalizedChar = normalizeUUID(char);
    return normalized === normalizedChar;
  });
};

// Find best matching write characteristic
const findWriteCharacteristic = (characteristics: any[]): any => {
  // First try to find a characteristic with write property
  let writeChar = characteristics.find(c => {
    const props = c.properties || {};
    return props.Write === 'Write' || props.write === true;
  });

  // If not found, look for writeWithoutResponse
  if (!writeChar) {
    writeChar = characteristics.find(c => {
      const props = c.properties || {};
      return (
        props.WriteWithoutResponse === 'WriteWithoutResponse' || props.writeWithoutResponse === true
      );
    });
  }

  // If still not found, try matching by UUID
  if (!writeChar) {
    writeChar = characteristics.find(c => isOBDCharacteristic(c.characteristic));
  }

  return writeChar;
};

// Find best matching notify characteristic
const findNotifyCharacteristic = (characteristics: any[]): any => {
  // First try to find a characteristic with notify property
  let notifyChar = characteristics.find(c => {
    const props = c.properties || {};
    return props.Notify === 'Notify' || props.notify === true;
  });

  // If not found, try matching by UUID
  if (!notifyChar) {
    notifyChar = characteristics.find(c => isOBDCharacteristic(c.characteristic));
  }

  return notifyChar;
};

export const findServiceAndCharacteristic = async (
  deviceId: string,
): Promise<ConnectionDetails | null> => {
  try {
    const deviceInfo = await BleManager.retrieveServices(deviceId);

    if (!deviceInfo.services || !deviceInfo.characteristics) {
      throw new Error('Failed to retrieve services or characteristics');
    }

    // Try to find an OBD service first
    let service = deviceInfo.services.find(s => isOBDService(s.uuid));

    // If no OBD service found, try to find any service with characteristics
    if (!service) {
      for (const s of deviceInfo.services) {
        const chars = deviceInfo.characteristics.filter(c => c.service === s.uuid);
        if (chars.length > 0) {
          service = s;
          break;
        }
      }
    }

    if (!service) {
      return null;
    }

    // Find characteristics for the service
    const characteristics = deviceInfo.characteristics.filter(c => c.service === service!.uuid);

    // Find write and notify characteristics
    const writeCharacteristic = findWriteCharacteristic(characteristics);
    const notifyCharacteristic = findNotifyCharacteristic(characteristics);

    if (!writeCharacteristic || !notifyCharacteristic) {
      throw new Error('Required characteristics not found');
    }

    const writeWithResponse = writeCharacteristic.properties?.Write === 'Write';

    return {
      serviceUUID: service.uuid,
      writeCharacteristicUUID: writeCharacteristic.characteristic,
      notifyCharacteristicUUID: notifyCharacteristic.characteristic,
      writeWithResponse,
    };
  } catch (error) {
    console.warn('Service discovery attempt failed:', error);
    return null;
  }
};

// Utility to check if a device is likely an OBD adapter
export const isLikelyOBDDevice = (device: any): boolean => {
  const name = (device.name || device.localName || '').toLowerCase();

  // Common OBD device name patterns
  const obdPatterns = ['obd', 'elm', 'car', 'vgate', 'obdii', 'eobd', 'scanner', 'diagnostic'];

  return obdPatterns.some(pattern => name.includes(pattern));
};
