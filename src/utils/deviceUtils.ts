import BleManager, { Peripheral } from 'react-native-ble-manager';

import { ConnectionDetails } from '../types/bluetoothTypes';

// Common service UUIDs for OBD adapters
const SERVICE_UUIDS = [
  'fff0', // Common ELM327 service
  'ffe0', // Alternative service
  '18f0', // Used by some clone adapters
  'beef', // Used by some Chinese adapters
];

/**
 * Find compatible service and characteristics for OBD device
 */
export async function findServiceAndCharacteristic(
  deviceId: string
): Promise<ConnectionDetails | null> {
  try {
    // Get device services
    const info = await BleManager.retrieveServices(deviceId);

    if (!info.services || !info.characteristics) {
      console.error('No services or characteristics found');
      return null;
    }

    // Find OBD service
    const service = info.services.find(s => {
      const uuid = s.uuid.toLowerCase();
      return SERVICE_UUIDS.some(id => 
        uuid === id || uuid === `0000${id}-0000-1000-8000-00805f9b34fb`
      );
    });

    if (!service) {
      console.error('No compatible OBD service found');
      return null;
    }

    // Find characteristics for this service
    const characteristics = info.characteristics.filter(
      c => c.service === service.uuid
    );

    // Find write characteristic (needs Write property)
    const writeCharacteristic = characteristics.find(c => 
      c.properties.Write || c.properties.WriteWithoutResponse
    );

    // Find notify characteristic (needs Notify property)
    const notifyCharacteristic = characteristics.find(c => 
      c.properties.Notify || c.properties.Indicate
    );

    if (!writeCharacteristic || !notifyCharacteristic) {
      console.error('Required characteristics not found');
      return null;
    }

    return {
      serviceUUID: service.uuid,
      writeCharacteristicUUID: writeCharacteristic.characteristic,
      notifyCharacteristicUUID: notifyCharacteristic.characteristic,
      writeWithResponse: !!writeCharacteristic.properties.Write
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
