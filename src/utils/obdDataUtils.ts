import { BluetoothOBDError, BluetoothErrorType } from './errorUtils';

export type DTCType = 'P' | 'C' | 'B' | 'U';
export type DTCPrefix = `${DTCType}${number}`;
export type DTCCode = `${DTCPrefix}${string}`;

export interface ParsedDTC {
  code: DTCCode;
  type: DTCType;
  description?: string;
}

/**
 * Utility functions for interpreting OBD-II data responses
 */

/**
 * Convert mode 01 PID 0C (Engine RPM) response to RPM
 * @param hexData The hex data response from RPM command
 * @returns Engine RPM or null if invalid
 */
export const parseEngineRPM = (hexData: string): number | null => {
  try {
    const cleanedHex = hexData.replace(/\s/g, '');

    // Check if the response is valid - RPM returns 2 bytes
    if (cleanedHex.length < 4) {
      return null;
    }

    // Get the last 4 characters (2 bytes) of hex data
    const hexBytes = cleanedHex.slice(-4);
    const a = parseInt(hexBytes.substring(0, 2), 16);
    const b = parseInt(hexBytes.substring(2, 4), 16);

    // RPM = ((A*256)+B)/4
    return (a * 256 + b) / 4;
  } catch (error) {
    throw new BluetoothOBDError(
      BluetoothErrorType.DATA_ERROR,
      `Error parsing Engine RPM: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Convert mode 01 PID 0D (Vehicle Speed) response to km/h
 * @param hexData The hex data response from speed command
 * @returns Vehicle speed in km/h or null if invalid
 */
export const parseVehicleSpeed = (hexData: string): number | null => {
  try {
    const cleanedHex = hexData.replace(/\s/g, '');

    // Check if the response is valid - speed returns 1 byte
    if (cleanedHex.length < 2) {
      return null;
    }

    // Get the hex byte (last 2 characters)
    const hexByte = cleanedHex.slice(-2);

    // Convert to decimal - direct value in km/h
    return parseInt(hexByte, 16);
  } catch (error) {
    throw new BluetoothOBDError(
      BluetoothErrorType.DATA_ERROR,
      `Error parsing Vehicle Speed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Convert mode 01 PID 05 (Engine Coolant Temperature) response to °C
 * @param hexData The hex data response from coolant temp command
 * @returns Temperature in °C or null if invalid
 */
export const parseEngineCoolantTemp = (hexData: string): number | null => {
  try {
    const cleanedHex = hexData.replace(/\s/g, '');

    // Check if the response is valid - temp returns 1 byte
    if (cleanedHex.length < 2) {
      return null;
    }

    // Get the hex byte (last 2 characters)
    const hexByte = cleanedHex.slice(-2);

    // Convert to decimal and calculate temperature
    // Temp = A - 40 (°C)
    return parseInt(hexByte, 16) - 40;
  } catch (error) {
    throw new BluetoothOBDError(
      BluetoothErrorType.DATA_ERROR,
      `Error parsing Coolant Temperature: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

/**
 * Convert mode 01 PID 11 (Throttle Position) response to percentage
 * @param hexData The hex data response from throttle position command
 * @returns Throttle position percentage or null if invalid
 */
export const parseThrottlePosition = (hexData: string): number | null => {
  try {
    const cleanedHex = hexData.replace(/\s/g, '');

    // Check if the response is valid - throttle returns 1 byte
    if (cleanedHex.length < 2) {
      return null;
    }

    // Get the hex byte (last 2 characters)
    const hexByte = cleanedHex.slice(-2);

    // Convert to decimal and calculate percentage
    // Position = (A * 100) / 255
    return (parseInt(hexByte, 16) * 100) / 255;
  } catch (error) {
    throw new BluetoothOBDError(
      BluetoothErrorType.DATA_ERROR,
      `Error parsing Throttle Position: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Parse DTC (Diagnostic Trouble Code) response
 * @param hexData The hex data response from DTC command
 * @returns Array of DTC codes or empty array if none/invalid
 */
export const parseDTCResponse = (hexData: string): DTCCode[] => {
  try {
    // Remove all spaces and unwanted characters
    const cleanedHex = hexData.replace(/[\s\r\n>]/g, '');

    if (!cleanedHex || cleanedHex === 'NODATA' || cleanedHex === '43NODATA') {
      return [];
    }

    // Skip the first two characters (43 = response code for DTCs)
    const dtcHex = cleanedHex.substring(2);

    const dtcCodes: DTCCode[] = [];

    // Process in chunks of 4 characters (each DTC is 4 characters)
    for (let i = 0; i < dtcHex.length; i += 4) {
      if (i + 4 <= dtcHex.length) {
        const dtcChunk = dtcHex.substring(i, i + 4);

        // Skip if it's all zeros
        if (dtcChunk === '0000') continue;

        // Convert to standard DTC format
        const dtcFormatted = formatDTC(dtcChunk);
        if (dtcFormatted) {
          dtcCodes.push(dtcFormatted);
        }
      }
    }

    return dtcCodes;
  } catch (error) {
    throw new BluetoothOBDError(
      BluetoothErrorType.DATA_ERROR,
      `Error parsing DTC response: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Format DTC code from raw hex to standard format (e.g. P0101)
 * @param dtcHex 4-character hex code
 * @returns Formatted DTC code or null if invalid
 */
export const formatDTC = (dtcHex: string): DTCCode | null => {
  if (!dtcHex || dtcHex.length !== 4) {
    return null;
  }

  try {
    // Get first digit to determine DTC type
    const firstDigit = parseInt(dtcHex[0], 16);
    const prefix = getDTCPrefix(firstDigit);

    if (!prefix) return null;

    // Use the rest of the DTC hex code
    const digits = dtcHex.substring(1).toUpperCase();

    return `${prefix}${digits}` as DTCCode;
  } catch (error) {
    throw new BluetoothOBDError(
      BluetoothErrorType.DATA_ERROR,
      `Error formatting DTC: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Get DTC prefix based on first digit
 * @param firstDigit The first digit of DTC hex code
 * @returns DTC prefix or null if invalid
 */
export const getDTCPrefix = (firstDigit: number): DTCPrefix | null => {
  switch (firstDigit) {
    case 0:
      return 'P0';
    case 1:
      return 'P1';
    case 2:
      return 'P2';
    case 3:
      return 'P3';
    case 4:
      return 'C0';
    case 5:
      return 'C1';
    case 6:
      return 'C2';
    case 7:
      return 'C3';
    case 8:
      return 'B0';
    case 9:
      return 'B1';
    case 10:
      return 'B2';
    case 11:
      return 'B3';
    case 12:
      return 'U0';
    case 13:
      return 'U1';
    case 14:
      return 'U2';
    case 15:
      return 'U3';
    default:
      return null;
  }
};
