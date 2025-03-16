import BleManager from 'react-native-ble-manager';
import { ConnectionDetails } from '../types/bluetoothTypes';
import { Platform } from 'react-native';

// Common ELM327 service UUIDs (these are generic - actual devices might have specific ones)
const COMMON_OBD_SERVICES = [
  'FFE0', // Common for many ELM327 adapters
  'FFF0', 
  '18F0', // Some adapters use this
  'BEEF', // Other adapters
  'FFE1', // Some Chinese adapters
  'FFF1',
  'AB90', // Additional OBD adapter
  '0000FFE0-0000-1000-8000-00805F9B34FB', // Full UUID format
  '0000FFF0-0000-1000-8000-00805F9B34FB',
  '00001801-0000-1000-8000-00805F9B34FB', // Generic Attribute Profile
];

// Common characteristic UUIDs
const COMMON_CHARACTERISTICS = [
  'FFE1',
  'FFF1',
  '2A00', // Device name
  '2A01', // Appearance
  '2A05', // Service Changed
];

// Normalize UUID format for comparison
const normalizeUUID = (uuid: string): string => {
  uuid = uuid.toUpperCase();
  
  // Convert short UUID to full format if on iOS and it's a short UUID
  if (Platform.OS === 'ios' && uuid.length <= 8) {
    return `0000${uuid.padStart(4, '0')}-0000-1000-8000-00805F9B34FB`;
  }
  
  return uuid;
};

// Check if a UUID matches any common OBD service UUID
const matchesCommonOBDService = (uuid: string): boolean => {
  const normalizedUuid = normalizeUUID(uuid);
  return COMMON_OBD_SERVICES.some(obdService => {
    const normalizedOBDService = normalizeUUID(obdService);
    return normalizedUuid === normalizedOBDService || normalizedUuid.includes(normalizedOBDService.replace(/-/g, ''));
  });
};

// Try to find appropriate service and characteristics for an OBD device
export const findServiceAndCharacteristic = async (
  deviceId: string,
  retryAttempts = 3
): Promise<ConnectionDetails | null> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      // If this isn't the first attempt, wait before retrying
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Retrieve services and characteristics
      const deviceInfo = await BleManager.retrieveServices(deviceId);
      
      if (!deviceInfo.services || deviceInfo.services.length === 0) {
        throw new Error('No services found for this device');
      }
      
      console.log(`Attempt ${attempt}: Found ${deviceInfo.services.length} services for device ${deviceId}`);
      
      // Look for known OBD services first
      let targetService = deviceInfo.services.find(service => matchesCommonOBDService(service.uuid));
      
      // If no known OBD service found, try to use the first service that has characteristics
      if (!targetService) {
        console.log('No known OBD service found, searching for service with characteristics');
        for (const service of deviceInfo.services) {
          const characteristics = await BleManager.retrieveServices(deviceId);
          const serviceData = characteristics.services.find(s => s.uuid === service.uuid);
          if (serviceData?.characteristics?.length > 0) {
            targetService = service;
            break;
          }
        }
      }
      
      if (!targetService) {
        throw new Error('Could not find suitable service for OBD communication');
      }
      
      console.log(`Selected service: ${targetService.uuid}`);
      
      // Get characteristics for the found service
      const characteristics = deviceInfo.characteristics.filter(c => c.service === targetService!.uuid);
      
      if (!characteristics || characteristics.length === 0) {
        throw new Error('No characteristics found for this service');
      }
      
      // Enhanced characteristic selection logic
      const result = findBestCharacteristicSet(characteristics);
      
      if (!result.writeCharacteristic || !result.notifyCharacteristic) {
        throw new Error('Could not find required characteristics for OBD communication');
      }
      
      // Return the connection details
      return {
        serviceUUID: targetService.uuid,
        writeCharacteristicUUID: result.writeCharacteristic.characteristic,
        readCharacteristicUUID: (result.readCharacteristic || result.writeCharacteristic).characteristic,
        notifyCharacteristicUUID: result.notifyCharacteristic.characteristic,
        writeWithResponse: result.writeWithResponse
      };
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed:`, error);
      
      // If this was our last attempt, throw the error
      if (attempt === retryAttempts) {
        throw lastError;
      }
    }
  }
  
  // This should never be reached due to throw in the loop, but TypeScript needs it
  throw lastError || new Error('Failed to find service and characteristics');
};

// Helper function to find the best set of characteristics
function findBestCharacteristicSet(characteristics: any[]) {
  let writeCharacteristic = null;
  let readCharacteristic = null;
  let notifyCharacteristic = null;
  let writeWithResponse = false;

  // First pass: Look for characteristics with multiple capabilities
  for (const char of characteristics) {
    const props = char.properties || {};
    
    const canWrite = props.Write === 'Write' || 
                    props.WriteWithoutResponse === 'WriteWithoutResponse' ||
                    props.write === true || 
                    props.writeWithoutResponse === true;
    
    const canRead = props.Read === 'Read' || props.read === true;
    const canNotify = props.Notify === 'Notify' || props.notify === true;
    
    // Prefer characteristics that can both write and notify
    if (canWrite && canNotify) {
      writeCharacteristic = char;
      notifyCharacteristic = char;
      writeWithResponse = props.Write === 'Write' || props.write === true;
    }
    
    // Store individual capabilities if we don't find a multi-capable one
    if (canWrite && !writeCharacteristic) {
      writeCharacteristic = char;
      writeWithResponse = props.Write === 'Write' || props.write === true;
    }
    
    if (canRead && !readCharacteristic) {
      readCharacteristic = char;
    }
    
    if (canNotify && !notifyCharacteristic) {
      notifyCharacteristic = char;
    }
  }
  
  // Fallback: If we don't have all required characteristics, use the first one
  // This works with many generic ELM327 adapters
  if (characteristics.length > 0) {
    if (!writeCharacteristic) writeCharacteristic = characteristics[0];
    if (!notifyCharacteristic) notifyCharacteristic = characteristics[0];
  }
  
  return {
    writeCharacteristic,
    readCharacteristic,
    notifyCharacteristic,
    writeWithResponse
  };
}
