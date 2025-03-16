import convertString from 'convert-string';
import { TextDecoder } from 'text-decoding';

// Common response terminators for OBD devices
const TERMINATORS = ['>', '\r\r>', '\r\n>', '\n>'];
const SUCCESS_RESPONSES = ['OK', 'ELM327'];
const ERROR_RESPONSES = ['?', 'ERROR', 'UNABLE TO CONNECT', 'NO DATA'];

/**
 * Decode raw byte data from BLE device
 */
export const decodeData = (data: number[]): string => {
  try {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(new Uint8Array(data));
    }
    // Fallback for platforms without TextDecoder
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
    // For platforms with TextEncoder
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(command));
    }
    // Use convert-string for platforms without TextEncoder
    return convertString.stringToBytes(command);
  } catch (error) {
    console.error('Error encoding command:', error);
    return Array.from(command).map(c => c.charCodeAt(0));
  }
};

/**
 * Check if a response indicates command completion
 */
export const isResponseComplete = (response: string): boolean => {
  if (!response) return false;
  
  const cleanResponse = response.trim();
  
  // Check for error responses first
  if (ERROR_RESPONSES.some(err => cleanResponse.includes(err))) {
    return true;
  }
  
  // Check for success responses
  const hasSuccessIndicator = SUCCESS_RESPONSES.some(
    success => cleanResponse.includes(success)
  );
  
  // Check for command terminator
  const hasTerminator = TERMINATORS.some(
    term => response.endsWith(term)
  );
  
  // Response is complete if we have a terminator,
  // or if we have a success indicator with a carriage return
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
    const cmdStr = command.replace('\r', '');
    formatted = formatted.replace(new RegExp(`^${cmdStr}\r?`), '');
  }
  
  // Remove terminators
  TERMINATORS.forEach(term => {
    formatted = formatted.replace(term, '');
  });
  
  // Clean up whitespace and line endings
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
  return ERROR_RESPONSES.some(err => response.includes(err));
};

/**
 * Add carriage return to command if needed
 */
export const formatCommand = (command: string): string => {
  return command.endsWith('\r') ? command : `${command}\r`;
};

/**
 * Convert hex string to bytes (for raw command sending)
 */
export const hexToBytes = (hex: string): number[] => {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
};

/**
 * Convert bytes to hex string (for raw response parsing)
 */
export const bytesToHex = (bytes: number[]): string => {
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
};
