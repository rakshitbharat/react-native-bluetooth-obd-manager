import { TextDecoder } from 'text-decoding';
import convertString from 'convert-string';

// Character that indicates the end of an OBD response
const RESPONSE_TERMINATOR = '>';

/**
 * Decode array buffer to string
 * @param data Byte array to decode
 */
export const decodeData = (data: number[]): string => {
  try {
    // First try using TextDecoder (more modern approach)
    const decoder = new TextDecoder('utf-8');
    const uint8Array = new Uint8Array(data);
    return decoder.decode(uint8Array);
  } catch (error) {
    // Fallback to convert-string if TextDecoder fails
    try {
      return convertString.bytesToString(data);
    } catch (innerError) {
      console.error('Failed to decode data:', innerError);
      // Last resort: manual conversion
      return data.map(byte => String.fromCharCode(byte)).join('');
    }
  }
};

/**
 * Encode string to bytes array
 * @param command Command string to encode
 */
export const encodeCommand = (command: string): number[] => {
  try {
    return convertString.stringToBytes(command);
  } catch (error) {
    console.error('Failed to encode command:', error);
    // Manual encoding as fallback
    return Array.from(command).map(char => char.charCodeAt(0));
  }
};

/**
 * Check if OBD response is complete (contains prompt character '>')
 * @param response Response string to check
 */
export const isResponseComplete = (response: string): boolean => {
  return response.includes(RESPONSE_TERMINATOR);
};

/**
 * Clean up OBD response by removing noise and extra characters
 * @param response Raw response to clean
 */
export const cleanResponse = (response: string): string => {
  // Remove line feeds, carriage returns, and '>' prompt
  let cleaned = response.replace(/[\r\n>]/g, '');
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // Remove echo of command if present
  const echoParts = cleaned.split('\r');
  if (echoParts.length > 1) {
    cleaned = echoParts.slice(1).join('\r');
  }
  
  // Remove common "OK" and "NO DATA" responses if they're part of a larger response
  if (cleaned.includes('OK')) {
    cleaned = cleaned.replace('OK', '').trim();
  }
  
  if (cleaned.includes('NO DATA')) {
    cleaned = cleaned.replace('NO DATA', '').trim();
  }
  
  if (cleaned.includes('SEARCHING...')) {
    cleaned = cleaned.replace('SEARCHING...', '').trim();
  }
  
  return cleaned;
};

/**
 * Format the final response for the user
 * @param rawResponse Raw response from OBD device
 * @param command Command that was sent
 */
export const formatResponse = (rawResponse: string, command: string): string => {
  const cleaned = cleanResponse(rawResponse);
  
  // Handle specific command responses
  if (command === 'ATZ' || command === 'AT Z') {
    // Reset command might contain version info we want to keep
    return cleaned;
  }
  
  // Filter out echo of the command itself if present (common with ELM327)
  const commandWithoutSpaces = command.replace(/\s/g, '');
  if (cleaned.includes(commandWithoutSpaces)) {
    return cleaned.replace(commandWithoutSpaces, '').trim();
  }
  
  return cleaned;
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
