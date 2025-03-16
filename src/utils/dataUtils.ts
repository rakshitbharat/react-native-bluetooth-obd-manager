import { TextDecoder } from 'text-decoding';
import convertString from 'convert-string';
import { Platform } from 'react-native';

// Common response terminators
const RESPONSE_TERMINATORS = ['>', '\r\r>', '\r\n>', '\n>'];

// Success/failure indicators
const SUCCESS_INDICATORS = ['OK', 'ELM327'];
const ERROR_INDICATORS = ['?', 'ERROR', 'UNABLE TO CONNECT', 'NO DATA'];

/**
 * Decode raw byte data from BLE device
 */
export const decodeData = (data: number[]): string => {
  try {
    // For web-like environments that support TextDecoder
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(new Uint8Array(data));
    }
    
    // Fallback for React Native
    return String.fromCharCode(...data);
  } catch (error) {
    console.error('Error decoding data:', error);
    return '';
  }
};

/**
 * Encode string command to bytes for sending to device
 */
export const encodeCommand = (command: string): number[] => {
  try {
    // For web-like environments that support TextEncoder
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(command));
    }
    
    // Fallback for React Native
    return Array.from(command).map(c => c.charCodeAt(0));
  } catch (error) {
    console.error('Error encoding command:', error);
    return [];
  }
};

/**
 * Check if a response is complete (contains terminator)
 */
export const isResponseComplete = (response: string): boolean => {
  if (!response) return false;
  
  // Clean the response
  const cleanResponse = response.trim();
  
  // Check for error indicators first
  if (ERROR_INDICATORS.some(indicator => cleanResponse.includes(indicator))) {
    return true;
  }
  
  // Check for success indicators
  const hasSuccessIndicator = SUCCESS_INDICATORS.some(
    indicator => cleanResponse.includes(indicator)
  );
  
  // Check for terminators
  const hasTerminator = RESPONSE_TERMINATORS.some(
    terminator => response.endsWith(terminator)
  );
  
  // Consider response complete if we have both success indicator and terminator,
  // or if we have an error indicator
  return hasTerminator || (hasSuccessIndicator && response.includes('\r'));
};

/**
 * Format the raw response for consumption
 */
export const formatResponse = (response: string, command?: string): string => {
  if (!response) return '';
  
  // Remove command echo if present
  let formatted = response;
  if (command) {
    const commandStr = command.replace('\r', '');
    formatted = formatted.replace(new RegExp(`^${commandStr}\r?`), '');
  }
  
  // Remove terminators
  RESPONSE_TERMINATORS.forEach(terminator => {
    formatted = formatted.replace(terminator, '');
  });
  
  // Clean up line endings and whitespace
  formatted = formatted
    .replace(/[\r\n]+/g, ' ')  // Replace line endings with space
    .replace(/\s+/g, ' ')      // Normalize spaces
    .trim();                   // Remove leading/trailing whitespace
    
  return formatted;
};

/**
 * Check if response indicates an error
 */
export const isErrorResponse = (response: string): boolean => {
  if (!response) return false;
  return ERROR_INDICATORS.some(indicator => response.includes(indicator));
};

/**
 * Extract the meaningful part of a response (removing protocol overhead)
 */
export const extractResponseData = (response: string): string => {
  // Remove search pattern bytes (if present)
  response = response.replace(/^[0-9A-F]{2}\s[0-9A-F]{2}\s/, '');
  
  // Remove service mode echo (if present)
  response = response.replace(/^4[0-9A-F]\s/, '');
  
  return response.trim();
};

/**
 * Convert hex string to bytes
 */
export const hexToBytes = (hex: string): number[] => {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
};

/**
 * Convert bytes to hex string
 */
export const bytesToHex = (bytes: number[]): string => {
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Convert hex string response to decimal value
 * For processing certain OBD PIDs that return hex values
 * @param hexStr Hex string
 */
export const hexToDecimal = (hexStr: string): number => {
  return parseInt(hexStr, 16);
};

/**
 * Calculate checksum used in some OBD protocols
 * @param data Byte array
 */
export const calculateChecksum = (data: number[]): number => {
  return data.reduce((acc, val) => acc ^ val, 0);
};
