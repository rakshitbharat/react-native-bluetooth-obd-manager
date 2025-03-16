import BleManager from 'react-native-ble-manager';
import { ConnectionDetails } from '../types/bluetoothTypes';
import { Platform } from 'react-native';

// Common ELM327 service UUIDs (these are generic - actual devices might have specific ones)
const COMMON_OBD_SERVICES = [
  'FFE0', // Common for many ELM327 adapters
  'FFF0', 
  '18F0', // Some adapters use this
  'BEEF', // Other adapters
  '0000FFE0-0000-1000-8000-00805F9B34FB', // Full UUID format
  '0000FFF0-0000-1000-8000-00805F9B34FB',
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
  deviceId: string
): Promise<ConnectionDetails | null> => {
  try {
    // Retrieve services and characteristics
    const deviceInfo = await BleManager.retrieveServices(deviceId);
    
    if (!deviceInfo.services || deviceInfo.services.length === 0) {
      throw new Error('No services found for this device');
    }
    
    console.log(`Found ${deviceInfo.services.length} services for device ${deviceId}`);
    
    // Look for known OBD services first
    let targetService = deviceInfo.services.find(service => matchesCommonOBDService(service.uuid));
    
    // If no known OBD service found, try to use the first service that has characteristics
    if (!targetService) {
      console.log('No known OBD service found, searching for service with characteristics');
      for (const service of deviceInfo.services) {
        const characteristics = await BleManager.retrieveServices(deviceId);
        const serviceData = characteristics.services.find(s => s.uuid === service.uuid);
        if (serviceData && serviceData.characteristics && serviceData.characteristics.length > 0) {
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
    
    // Find the right characteristics
    let writeCharacteristic = null;
    let readCharacteristic = null;
    let notifyCharacteristic = null;
    let writeWithResponse = false;
    
    // Analyze each characteristic to determine its purpose
    for (const char of characteristics) {
      // For older BLE library versions, properties might be an object with boolean values
      const props = char.properties || {};
      
      // Check for write properties
      const canWrite = props.Write === 'Write' || 
                      props.WriteWithoutResponse === 'WriteWithoutResponse' ||
                      props.write === true || 
                      props.writeWithoutResponse === true;
      
      // Check for read property
      const canRead = props.Read === 'Read' || props.read === true;
      
      // Check for notify property
      const canNotify = props.Notify === 'Notify' || props.notify === true;
      
      if (canWrite) {
        writeCharacteristic = char;
        writeWithResponse = props.Write === 'Write' || props.write === true;
      }
      
      if (canRead) {
        readCharacteristic = char;
      }
      
      if (canNotify) {
        notifyCharacteristic = char;
      }
      
      console.log(`Characteristic ${char.characteristic} - Write: ${canWrite}, Read: ${canRead}, Notify: ${canNotify}`);
    }
    
    // If no specific characteristics found, try to use the first characteristic for everything
    // This works with many generic ELM327 adapters which use a single characteristic
    if (!writeCharacteristic && characteristics.length > 0) {
      writeCharacteristic = characteristics[0];
      console.log('Using first characteristic for write:', writeCharacteristic.characteristic);
    }
    
    if (!readCharacteristic && characteristics.length > 0) {
      readCharacteristic = characteristics[0];
      console.log('Using first characteristic for read:', readCharacteristic.characteristic);
    }
    
    if (!notifyCharacteristic && characteristics.length > 0) {
      notifyCharacteristic = characteristics[0];
      console.log('Using first characteristic for notify:', notifyCharacteristic.characteristic);
    }
    
    // If we still don't have the required characteristics, fail
    if (!writeCharacteristic || !notifyCharacteristic) {
      throw new Error('Could not find required characteristics for OBD communication');
    }
    
    // Prefer the dedicated read characteristic, but fall back to write characteristic if needed
    const finalReadChar = readCharacteristic || writeCharacteristic;
    
    // Return the connection details
    return {
      serviceUUID: targetService.uuid,
      writeCharacteristicUUID: writeCharacteristic.characteristic,
      readCharacteristicUUID: finalReadChar.characteristic,
      notifyCharacteristicUUID: notifyCharacteristic.characteristic,
      writeWithResponse
    };
  } catch (error) {
    console.error('Error finding service and characteristic:', error);
    return null;
  }
};
