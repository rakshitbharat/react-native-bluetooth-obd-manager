import BleManager, { Peripheral } from 'react-native-ble-manager';
import type { PeripheralInfo } from 'react-native-ble-manager';
import type { ConnectionDetails } from '../types/bluetoothTypes';
import { Platform } from 'react-native';

// Common service UUIDs for OBD adapters
const SERVICE_UUIDS = [
  'fff0', // Common ELM327 service
  'ffe0', // Alternative service
  '18f0', // Used by some clone adapters
  'beef', // Used by some Chinese adapters
];

/**
 * Default UUIDs
 */
const DEFAULT_SERVICE_UUID = 'FFE0';
const DEFAULT_CHARACTERISTIC_UUID = 'FFE1';

/**
 * Find suitable Bluetooth service and characteristics for OBD communication
 */
export async function findServiceAndCharacteristic(
  peripheral: PeripheralInfo,
): Promise<ConnectionDetails | null> {
  try {
    if (!peripheral?.services?.length) {
      return null;
    }

    // Find suitable service
    const service = peripheral.services.find(s => {
      const uuid = Platform.OS === 'ios' ? s.uuid.toLowerCase() : s.uuid;
      return uuid.includes('ffe0') || uuid.includes('fff0');
    });

    if (!service) {
      return null;
    }

    // Find characteristics
    const characteristics = peripheral.characteristics?.filter(
      c => c.service === service.uuid,
    );

    if (!characteristics?.length) {
      return null;
    }

    // Find write characteristic (prefer write without response)
    const writeCharacteristic = characteristics.find(
      c => c.properties?.WriteWithoutResponse || c.properties?.Write,
    );

    // Find notify characteristic
    const notifyCharacteristic = characteristics.find(
      c => c.properties?.Notify || c.characteristic === DEFAULT_CHARACTERISTIC_UUID,
    );

    if (!writeCharacteristic || !notifyCharacteristic) {
      return null;
    }

    // Determine write type
    const writeWithResponse = !writeCharacteristic.properties?.WriteWithoutResponse;

    return {
      serviceUUID: service.uuid,
      writeCharacteristicUUID: writeCharacteristic.characteristic,
      notifyCharacteristicUUID: notifyCharacteristic.characteristic,
      writeWithResponse,
    };
  } catch (error) {
    console.error('Error finding service/characteristics:', error);
    return null;
  }
}

/**
 * Check if a device is likely an OBD device based on name
 */
export const isOBDDevice = (device: Peripheral): boolean => {
  if (!device || !device.name) return false;

  const keywords = ['obd', 'elm', 'elm327', 'obdii', 'eobd', 'car', 'scanner', 'vgate'];
  const deviceName = device.name.toLowerCase();
  
  return keywords.some(keyword => deviceName.includes(keyword));
};

/**
 * Get a friendly name for the device
 */
export const getDeviceName = (device: Peripheral): string => {
  if (!device) return 'Unknown Device';
  
  if (device.name) {
    return device.name;
  } else if (device.id) {
    return `Device (${device.id})`;
  }
  
  return 'Unknown Device';
};

// Export necessary interfaces and types
export interface DeviceInfo {
  id: string;
  name: string;
  rssi: number;
  isOBDDevice: boolean;
}

export interface ServiceInfo {
  uuid: string;
  isPrimary: boolean;
}
