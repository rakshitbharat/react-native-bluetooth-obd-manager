import { Platform } from 'react-native';
import BleManager, { Peripheral } from 'react-native-ble-manager';
import type { PeripheralInfo } from 'react-native-ble-manager';

import type { ConnectionDetails } from '../types/bluetoothTypes';

// Common service UUIDs for OBD adapters
const SERVICE_UUIDS = [
  'fff0', // Common ELM327 service
  'ffe0', // Alternative service
  '18f0', // Used by some clone adapters
  'beef', // Used by some Chinese adapters
  'e7a1', // Another variant
  'ffe1', // Some Chinese clones
  'fff1', // Another clone variant
];

/**
 * Find suitable Bluetooth service and characteristics for OBD communication
 * Smartly detects the right service and characteristics for different types of OBD adapters
 */
export async function findServiceAndCharacteristic(
  peripheralInfo: PeripheralInfo,
): Promise<ConnectionDetails | null> {
  try {
    if (!peripheralInfo?.services?.length) {
      console.warn('No services found in peripheral');
      return null;
    }

    // Find suitable service
    const service = peripheralInfo.services.find(s => {
      const uuid = Platform.OS === 'ios' ? s.uuid.toLowerCase() : s.uuid;
      return SERVICE_UUIDS.some(serviceId => 
        uuid.includes(serviceId) || 
        uuid === `0000${serviceId}-0000-1000-8000-00805f9b34fb`
      );
    });

    if (!service) {
      console.warn('No compatible OBD service found');
      return null;
    }

    // Find characteristics
    const characteristics = peripheralInfo.characteristics?.filter(
      c => c.service === service.uuid,
    );

    if (!characteristics?.length) {
      console.warn('No characteristics found for service');
      return null;
    }

    // Find write characteristic (prefer write without response)
    const writeCharacteristic = findWriteCharacteristic(characteristics);

    // Find notify characteristic
    const notifyCharacteristic = findNotifyCharacteristic(characteristics);

    if (!writeCharacteristic || !notifyCharacteristic) {
      console.warn('Required characteristics not found', 
        writeCharacteristic ? 'Write: Yes' : 'Write: No', 
        notifyCharacteristic ? 'Notify: Yes' : 'Notify: No');
      return null;
    }

    // Determine write type
    const writeWithResponse = shouldUseWriteWithResponse(writeCharacteristic);

    return {
      serviceUUID: service.uuid,
      characteristicUUID: notifyCharacteristic.characteristic,
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
 * Find the best write characteristic for OBD communication
 */
function findWriteCharacteristic(characteristics: any[]): any | null {
  // First try to find a characteristic with write without response (preferred)
  const writeWithoutResponse = characteristics.find(c => 
    c.properties?.WriteWithoutResponse === 'WriteWithoutResponse'
  );

  if (writeWithoutResponse) {
    return writeWithoutResponse;
  }

  // Fall back to write with response
  const writeWithResponse = characteristics.find(c => 
    c.properties?.Write === 'Write'
  );

  if (writeWithResponse) {
    return writeWithResponse;
  }

  // Last resort: any characteristic with a write property
  return characteristics.find(c => {
    const props = c.properties || {};
    return Object.keys(props).some(key => 
      key.toLowerCase().includes('write')
    );
  });
}

/**
 * Find the best notify characteristic for OBD communication
 */
function findNotifyCharacteristic(characteristics: any[]): any | null {
  // First try to find a characteristic with notify property
  const notifyChar = characteristics.find(c => 
    c.properties?.Notify === 'Notify'
  );

  if (notifyChar) {
    return notifyChar;
  }

  // Fall back to characteristics with common UUIDs
  const commonNotifyChar = characteristics.find(c => {
    const charUUID = c.characteristic.toLowerCase();
    return charUUID.includes('ffe1') || 
           charUUID.includes('fff1') || 
           charUUID.includes('fff2');
  });

  if (commonNotifyChar) {
    return commonNotifyChar;
  }

  // Last resort: just use the first characteristic
  return characteristics[0];
}

/**
 * Determine if we should use write with response based on characteristic
 */
function shouldUseWriteWithResponse(characteristic: any): boolean {
  // Prefer write without response for better performance with OBD adapters
  if (characteristic.properties?.WriteWithoutResponse === 'WriteWithoutResponse') {
    return false;
  }
  
  // Fall back to write with response if that's all that's available
  return true;
}

/**
 * Check if a device is likely an OBD device based on name
 */
export const isOBDDevice = (device: Peripheral): boolean => {
  if (!device || !device.name) return false;

  const deviceName = device.name.toLowerCase();
  
  // Common OBD device keywords
  const obdKeywords = [
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
    'veepeak',
    'konnwei',
    'diagnostic',
  ];

  // Check if any keywords match
  return obdKeywords.some(keyword => deviceName.includes(keyword));
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

/**
 * Get services for a peripheral with better error handling
 */
export async function getPeripheralServices(peripheralId: string): Promise<PeripheralInfo> {
  try {
    return await BleManager.retrieveServices(peripheralId);
  } catch (error) {
    console.error(`Error retrieving services for device ${peripheralId}:`, error);
    throw error;
  }
}

/**
 * Filter discovered devices to only show likely OBD devices
 */
export function filterOBDDevices(devices: Peripheral[]): Peripheral[] {
  return devices.filter(isOBDDevice);
}
