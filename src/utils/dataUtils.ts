import { Buffer } from 'buffer';

import { BluetoothOBDError, BluetoothErrorType } from './errorUtils';

/**
 * Utilities for encoding/decoding Bluetooth data
 * and handling OBD responses
 */

export const ERROR_RESPONSES = [
  'ERROR',
  'UNABLE TO CONNECT',
  'NO DATA',
  'STOPPED',
  'CAN ERROR',
  'BUS ERROR',
] as const;

export type ErrorResponse = (typeof ERROR_RESPONSES)[number];

export interface DecodedResponse<T> {
  value: T;
  raw: string;
  isError: boolean;
  errorType?: ErrorResponse;
}

/**
 * Convert byte array from BLE to string
 * @param data Byte array from BLE characteristic
 * @returns Decoded string
 * @throws {BluetoothOBDError} If decoding fails
 */
export const decodeData = (data: number[] | Uint8Array): string => {
  if (!data || (!Array.isArray(data) && !(data instanceof Uint8Array))) {
    throw new BluetoothOBDError(BluetoothErrorType.DATA_ERROR, 'Invalid data format for decoding');
  }

  try {
    const buffer = Array.isArray(data) ? Buffer.from(data) : Buffer.from(data);
    return buffer.toString();
  } catch (error) {
    throw new BluetoothOBDError(
      BluetoothErrorType.DATA_ERROR,
      `Failed to decode data: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Convert string to byte array for BLE transmission
 * @param text String to convert to bytes
 * @returns Byte array to send over BLE
 * @throws {BluetoothOBDError} If encoding fails
 */
export const encodeCommand = (text: string): number[] => {
  if (typeof text !== 'string') {
    throw new BluetoothOBDError(BluetoothErrorType.INVALID_PARAMETER, 'Command must be a string');
  }

  try {
    return Array.from(Buffer.from(text));
  } catch (error) {
    throw new BluetoothOBDError(
      BluetoothErrorType.DATA_ERROR,
      `Failed to encode command: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Check if a response from OBD is complete (contains the prompt character)
 * @param response Response from OBD device
 * @returns True if response is complete
 */
export const isResponseComplete = (response: string): boolean => {
  if (!response) return false;

  // The '>' prompt signals end of response
  if (response.includes('>')) return true;

  // Error responses don't include '>' but are still complete
  return ERROR_RESPONSES.some(pattern => response.includes(pattern));
};

/**
 * Format OBD response for display or further processing
 * Removes prompt characters, cleans up line breaks, etc.
 *
 * @param response - Raw response string from OBD device
 * @param command - Optional command that was sent (for context-specific formatting)
 * @returns Cleaned and formatted response string
 */
export const formatResponse = (response: string, command?: string): string => {
  if (!response) return '';

  try {
    // Remove common prompt characters and trim
    let result = response
      .replace(/[\r\n>]/g, ' ') // Replace newlines and prompt with space
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim(); // Remove leading/trailing whitespace

    // Handle empty responses
    if (!result || result === '') {
      return 'NO DATA';
    }

    // Additional format when command provided
    if (command) {
      // For AT commands, different formatting may be needed vs OBD
      if (command.startsWith('AT')) {
        // Some AT commands need special handling
        if (command === 'ATI' || command === 'AT@1' || command === 'AT@2') {
          // These return multi-line device info, preserve newlines
          result = response.replace(/[\r>]/g, '').trim();
        }
      } else {
        // For OBD commands, we might want to strip echo, etc.
        // Strip command echo if present at the beginning of response
        const cmdNoSpaces = command.replace(/\s/g, '').toUpperCase();
        const responseNoSpaces = result.replace(/\s/g, '').toUpperCase();

        if (responseNoSpaces.startsWith(cmdNoSpaces)) {
          result = result.substring(command.length).trim();
        }
      }
    }

    return result;
  } catch (error) {
    console.error('[ECUConnector] Error formatting response:', error);
    return response; // Return original if error
  }
};

/**
 * Parse OBD response to extract valuable data
 * @param hexData The hex data response
 * @param mode Command mode (default: '01')
 * @param pid Command PID
 * @returns Parsed value or original response if parsing fails
 */
export const parseOBDResponse = (hexData: string, mode = '01', pid = '00'): number | string => {
  try {
    // Clean up the response to get the data part only
    const cleanData = hexData.replace(/[\s>\r\n]/g, '');

    // Get just the response data part (remove mode and PID echo in response)
    let dataStart = cleanData.indexOf(mode + pid);
    if (dataStart < 0) {
      // Try the mode with 4 added (response often adds 4 to the mode)
      const responseMode = (parseInt(mode, 16) + 0x40).toString(16).padStart(2, '0').toUpperCase();
      dataStart = cleanData.indexOf(responseMode + pid);

      if (dataStart < 0) {
        return hexData;
      }
    }

    // Extract just the data part, skipping mode and PID
    const dataOnly = cleanData.substring(dataStart + 4);

    // Common OBD parsing cases
    switch (mode + pid) {
      // Engine RPM (mode 01, PID 0C)
      case '010C': {
        if (dataOnly.length < 4) return hexData;
        const a = parseInt(dataOnly.substring(0, 2), 16);
        const b = parseInt(dataOnly.substring(2, 4), 16);
        return (a * 256 + b) / 4;
      }

      // Vehicle speed (mode 01, PID 0D)
      case '010D': {
        if (dataOnly.length < 2) return hexData;
        return parseInt(dataOnly.substring(0, 2), 16);
      }

      // Coolant temperature (mode 01, PID 05)
      case '0105': {
        if (dataOnly.length < 2) return hexData;
        return parseInt(dataOnly.substring(0, 2), 16) - 40;
      }

      // Engine load (mode 01, PID 04)
      case '0104': {
        if (dataOnly.length < 2) return hexData;
        return (parseInt(dataOnly.substring(0, 2), 16) * 100) / 255;
      }

      // Throttle position (mode 01, PID 11)
      case '0111': {
        if (dataOnly.length < 2) return hexData;
        return (parseInt(dataOnly.substring(0, 2), 16) * 100) / 255;
      }

      // Fuel level (mode 01, PID 2F)
      case '012F': {
        if (dataOnly.length < 2) return hexData;
        return (parseInt(dataOnly.substring(0, 2), 16) * 100) / 255;
      }

      // Default: return the original response if not a known PID
      default:
        return hexData;
    }
  } catch (error) {
    throw new BluetoothOBDError(
      BluetoothErrorType.DATA_ERROR,
      `Failed to parse OBD data: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Extract hex data from response
 * @param response OBD response
 * @returns Hex data string or null if not valid
 */
export const extractHexData = (response: string): string | null => {
  // Remove all non-hex characters
  const hexOnly = response.replace(/[^0-9A-Fa-f]/g, '');
  return hexOnly.length > 0 ? hexOnly : null;
};

/**
 * Convert hex string to decimal value
 * @param hex Hex string
 * @returns Decimal value
 */
export const hexToDecimal = (hex: string): number => {
  if (!hex || !/^[0-9A-Fa-f]+$/.test(hex)) {
    throw new BluetoothOBDError(BluetoothErrorType.INVALID_PARAMETER, 'Invalid hex string');
  }
  return parseInt(hex, 16);
};

/**
 * Convert hex string to binary string
 * @param hex Hex string
 * @returns Binary string
 */
export const hexToBinary = (hex: string): string => {
  if (!hex || !/^[0-9A-Fa-f]+$/.test(hex)) {
    throw new BluetoothOBDError(BluetoothErrorType.INVALID_PARAMETER, 'Invalid hex string');
  }
  return parseInt(hex, 16)
    .toString(2)
    .padStart(hex.length * 4, '0');
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
  if (typeof command !== 'string') {
    throw new BluetoothOBDError(BluetoothErrorType.INVALID_PARAMETER, 'Command must be a string');
  }
  return command.endsWith('\r') ? command : `${command}\r`;
};

/**
 * Convert hex string to bytes (for raw command sending)
 */
export const hexToBytes = (hex: string): number[] => {
  if (!hex || !/^[0-9A-Fa-f]+$/.test(hex)) {
    throw new BluetoothOBDError(BluetoothErrorType.INVALID_PARAMETER, 'Invalid hex string');
  }

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
  if (!Array.isArray(bytes)) {
    throw new BluetoothOBDError(
      BluetoothErrorType.INVALID_PARAMETER,
      'Input must be an array of numbers',
    );
  }
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Extract the hex value from an OBD response
 * @param response The raw OBD response
 * @returns The extracted hex value or null for invalid responses
 */
export const extractValueFromResponse = (response: string): string | null => {
  if (typeof response !== 'string') {
    throw new BluetoothOBDError(BluetoothErrorType.INVALID_PARAMETER, 'Response must be a string');
  }

  // Handle error cases
  if (isErrorResponse(response)) {
    return null;
  }

  // Extract hex data after mode+pid bytes
  // For example, from "41 0C 1A F8", extract "1AF8"
  const parts = response.trim().split(' ');

  // Need at least 3 parts: mode, pid, and data
  if (parts.length < 3) {
    return null;
  }

  // Join all parts after mode and PID
  return parts.slice(2).join('');
};

/**
 * Check if OBD device is connected by sending a test command
 */
export const testOBDConnection = async (
  sendCommandFn: (cmd: string) => Promise<string>,
): Promise<boolean> => {
  try {
    const response = await sendCommandFn('ATZ');
    return response.includes('ELM') || response.includes('OBD');
  } catch (error) {
    return false;
  }
};
