/**
 * Utility functions for interpreting OBD-II data responses
 */

/**
 * Convert mode 01 PID 0C (Engine RPM) response to actual RPM value
 * @param hexData The hex data response from RPM command
 * @returns Engine RPM as a number or null if invalid
 */
export const parseEngineRPM = (hexData: string): number | null => {
  // Clean up any spaces or unwanted characters
  const cleanedHex = hexData.replace(/\s/g, '');
  
  // Check if the response is valid - RPM returns 4 bytes
  if (cleanedHex.length < 4) {
    return null;
  }
  
  try {
    // Get the hex bytes (last 4 characters for the data)
    const hexBytes = cleanedHex.substring(cleanedHex.length - 4);
    
    // Convert to decimal and calculate RPM
    // RPM = ((A * 256) + B) / 4
    const a = parseInt(hexBytes.substring(0, 2), 16);
    const b = parseInt(hexBytes.substring(2, 4), 16);
    
    return ((a * 256) + b) / 4;
  } catch (error) {
    console.error('Error parsing Engine RPM:', error);
    return null;
  }
};

/**
 * Convert mode 01 PID 0D (Vehicle Speed) response to km/h
 * @param hexData The hex data response from speed command
 * @returns Vehicle speed in km/h or null if invalid
 */
export const parseVehicleSpeed = (hexData: string): number | null => {
  const cleanedHex = hexData.replace(/\s/g, '');
  
  // Check if the response is valid - speed returns 1 byte
  if (cleanedHex.length < 2) {
    return null;
  }
  
  try {
    // Get the hex byte (last 2 characters)
    const hexByte = cleanedHex.substring(cleanedHex.length - 2);
    
    // Convert to decimal - direct value in km/h
    return parseInt(hexByte, 16);
  } catch (error) {
    console.error('Error parsing Vehicle Speed:', error);
    return null;
  }
};

/**
 * Convert mode 01 PID 05 (Engine Coolant Temperature) response to °C
 * @param hexData The hex data response from coolant temp command
 * @returns Temperature in °C or null if invalid
 */
export const parseEngineCoolantTemp = (hexData: string): number | null => {
  const cleanedHex = hexData.replace(/\s/g, '');
  
  // Check if the response is valid - temp returns 1 byte
  if (cleanedHex.length < 2) {
    return null;
  }
  
  try {
    // Get the hex byte (last 2 characters)
    const hexByte = cleanedHex.substring(cleanedHex.length - 2);
    
    // Convert to decimal and calculate temperature
    // Temp = A - 40 (°C)
    return parseInt(hexByte, 16) - 40;
  } catch (error) {
    console.error('Error parsing Coolant Temperature:', error);
    return null;
  }
};

/**
 * Convert mode 01 PID 11 (Throttle Position) response to percentage
 * @param hexData The hex data response from throttle position command
 * @returns Throttle position as percentage or null if invalid
 */
export const parseThrottlePosition = (hexData: string): number | null => {
  const cleanedHex = hexData.replace(/\s/g, '');
  
  // Check if the response is valid
  if (cleanedHex.length < 2) {
    return null;
  }
  
  try {
    // Get the hex byte (last 2 characters)
    const hexByte = cleanedHex.substring(cleanedHex.length - 2);
    
    // Convert to decimal and calculate percentage
    // Position = (A * 100) / 255
    const value = parseInt(hexByte, 16);
    return Math.round((value * 100) / 255);
  } catch (error) {
    console.error('Error parsing Throttle Position:', error);
    return null;
  }
};

/**
 * Parse diagnostic trouble codes from the response
 * @param hexData The hex data response from trouble codes command
 * @returns Array of DTC codes or empty array if none/invalid
 */
export const parseDTCResponse = (hexData: string): string[] => {
  try {
    // Remove all spaces and unwanted characters
    const cleanedHex = hexData.replace(/[\s\r\n>]/g, '');
    
    if (!cleanedHex || cleanedHex === 'NODATA' || cleanedHex === '43NODATA') {
      return [];
    }
    
    // Skip the first two characters (43 = response code for DTCs)
    const dtcHex = cleanedHex.substring(2);
    
    // Each DTC is 4 bytes
    const dtcCodes: string[] = [];
    
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
    console.error('Error parsing DTC response:', error);
    return [];
  }
};

/**
 * Format DTC code from raw hex to standard format (e.g. P0101)
 * @param dtcHex 4-character hex code
 * @returns Formatted DTC code or null if invalid
 */
export const formatDTC = (dtcHex: string): string | null => {
  if (!dtcHex || dtcHex.length !== 4) {
    return null;
  }
  
  try {
    const firstDigit = parseInt(dtcHex[0], 16);
    const prefix = getDTCPrefix(firstDigit);
    
    if (!prefix) return null;
    
    // Use the rest of the DTC hex code
    return prefix + dtcHex.substring(1);
  } catch (error) {
    return null;
  }
};

/**
 * Get the prefix letter for a DTC based on the first hex digit
 * @param firstDigit First hex digit of the DTC
 * @returns Prefix letter (P, C, B, U) and number or null if invalid
 */
const getDTCPrefix = (firstDigit: number): string | null => {
  switch (firstDigit) {
    case 0: return 'P0';
    case 1: return 'P1';
    case 2: return 'P2';
    case 3: return 'P3';
    case 4: return 'C0';
    case 5: return 'C1';
    case 6: return 'C2';
    case 7: return 'C3';
    case 8: return 'B0';
    case 9: return 'B1';
    case 10: return 'B2';
    case 11: return 'B3';
    case 12: return 'U0';
    case 13: return 'U1';
    case 14: return 'U2';
    case 15: return 'U3';
    default: return null;
  }
};
