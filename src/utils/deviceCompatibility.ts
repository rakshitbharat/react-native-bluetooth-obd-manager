import { Peripheral } from 'react-native-ble-manager';

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
  'interface'
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
  'printer'
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
