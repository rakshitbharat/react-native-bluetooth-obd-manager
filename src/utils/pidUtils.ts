/**
 * Utilities for handling OBD PIDs (Parameter IDs)
 */

/**
 * PID details including unit, name, and min/max values
 */
export interface PidInfo {
  name: string;
  description: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  mode: number;
  pid: number;
  bytes: number;
  formula?: string;
}

/**
 * Standard OBD modes
 */
export enum OBDMode {
  CURRENT_DATA = 1,
  FREEZE_FRAME = 2,
  STORED_DTC = 3,
  CLEAR_DTC = 4,
  O2_MONITOR = 5,
  TEST_RESULTS = 6,
  PENDING_DTC = 7,
  CONTROL = 8,
  VEHICLE_INFO = 9,
  PERMANENT_DTC = 10
}

/**
 * Map of supported PIDs and their details
 */
export const PID_INFO: Record<string, PidInfo> = {
  // Mode 1 PIDs (current data)
  '0100': { name: 'PIDs Supported [01-20]', description: 'Supported PIDs in range 01-20', unit: 'Bitmap', mode: 1, pid: 0, bytes: 4, formula: 'Bitmap' },
  '0101': { name: 'Monitor Status', description: 'OBD Monitor status since DTCs cleared', unit: 'Bitmap', mode: 1, pid: 1, bytes: 4, formula: 'Bitmap' },
  '0104': { name: 'Engine Load', description: 'Calculated engine load', unit: '%', mode: 1, pid: 4, bytes: 1, minValue: 0, maxValue: 100, formula: 'A * 100 / 255' },
  '0105': { name: 'Coolant Temp', description: 'Engine coolant temperature', unit: '°C', mode: 1, pid: 5, bytes: 1, minValue: -40, maxValue: 215, formula: 'A - 40' },
  '010C': { name: 'Engine RPM', description: 'Engine RPM', unit: 'rpm', mode: 1, pid: 12, bytes: 2, minValue: 0, maxValue: 16383.75, formula: '((A * 256) + B) / 4' },
  '010D': { name: 'Vehicle Speed', description: 'Vehicle speed', unit: 'km/h', mode: 1, pid: 13, bytes: 1, minValue: 0, maxValue: 255, formula: 'A' },
  '010F': { name: 'Intake Temp', description: 'Intake air temperature', unit: '°C', mode: 1, pid: 15, bytes: 1, minValue: -40, maxValue: 215, formula: 'A - 40' },
  '0111': { name: 'Throttle Position', description: 'Throttle position', unit: '%', mode: 1, pid: 17, bytes: 1, minValue: 0, maxValue: 100, formula: 'A * 100 / 255' },
  '011C': { name: 'OBD Standard', description: 'OBD standards this vehicle conforms to', unit: '', mode: 1, pid: 28, bytes: 1, formula: 'Enum' },
  '0120': { name: 'PIDs Supported [21-40]', description: 'Supported PIDs in range 21-40', unit: 'Bitmap', mode: 1, pid: 32, bytes: 4, formula: 'Bitmap' },
  
  // Mode 9 PIDs (vehicle info)
  '0902': { name: 'VIN', description: 'Vehicle Identification Number', unit: '', mode: 9, pid: 2, bytes: 20, formula: 'ASCII' }
};

/**
 * Format a PID command string
 * @param mode OBD mode
 * @param pid PID number
 * @returns Formatted command string
 */
export const formatPidCommand = (mode: number, pid: number): string => {
  return `${mode.toString(16).padStart(2, '0')}${pid.toString(16).padStart(2, '0')}`;
};

/**
 * Get hex response value from a mode+pid response
 * @param response Raw response string
 * @param mode OBD mode used in request
 * @param pid PID number used in request
 * @returns Hex data portion of the response
 */
export const getResponseValue = (response: string, mode: number, pid: number): string => {
  // Clean up response
  const cleanResponse = response.replace(/[\r\n\s>]/g, '');
  
  // Expected header for response (mode + 40, pid)
  const expectedHeader = `${(mode + 0x40).toString(16).padStart(2, '0')}${pid.toString(16).padStart(2, '0')}`;
  
  // Find where the actual data starts
  const headerIndex = cleanResponse.toLowerCase().indexOf(expectedHeader.toLowerCase());
  
  if (headerIndex >= 0) {
    // Return all data after the header
    return cleanResponse.substring(headerIndex + expectedHeader.length);
  }
  
  // If header not found, return the cleaned response
  // (may contain the data portion only)
  return cleanResponse;
};

/**
 * Convert PID data to its real value based on the formula for that PID
 * @param hexData Hex data from OBD response
 * @param pidCode PID code (e.g., '010C')
 * @returns Calculated value or null if unknown PID
 */
export const convertPidValue = (hexData: string, pidCode: string): number | string | null => {
  // Check if we know about this PID
  const pidInfo = PID_INFO[pidCode];
  
  if (!pidInfo) {
    return null;
  }
  
  // Clean up the hex data
  const cleanHex = hexData.replace(/\s/g, '');
  
  // Different handling based on PID
  switch (pidCode) {
    case '010C': // Engine RPM
      try {
        // Get the 2 data bytes
        if (cleanHex.length >= 4) {
          const a = parseInt(cleanHex.substring(0, 2), 16);
          const b = parseInt(cleanHex.substring(2, 4), 16);
          return ((a * 256) + b) / 4;
        }
      } catch (e) {
        console.error('Error parsing Engine RPM:', e);
      }
      break;
      
    case '010D': // Vehicle Speed
      try {
        if (cleanHex.length >= 2) {
          return parseInt(cleanHex.substring(0, 2), 16);
        }
      } catch (e) {
        console.error('Error parsing Vehicle Speed:', e);
      }
      break;
      
    case '0105': // Coolant Temperature
    case '010F': // Intake Temperature
      try {
        if (cleanHex.length >= 2) {
          return parseInt(cleanHex.substring(0, 2), 16) - 40;
        }
      } catch (e) {
        console.error(`Error parsing Temperature (${pidCode}):`, e);
      }
      break;
      
    case '0104': // Engine Load
    case '0111': // Throttle Position
      try {
        if (cleanHex.length >= 2) {
          const value = parseInt(cleanHex.substring(0, 2), 16);
          return (value * 100) / 255;
        }
      } catch (e) {
        console.error(`Error parsing percentage value (${pidCode}):`, e);
      }
      break;
      
    case '0902': // VIN
      try {
        // Convert hex to ASCII
        let vin = '';
        for (let i = 0; i < cleanHex.length; i += 2) {
          const charCode = parseInt(cleanHex.substring(i, i + 2), 16);
          // Filter out non-printable characters
          if (charCode >= 32 && charCode <= 126) {
            vin += String.fromCharCode(charCode);
          }
        }
        return vin;
      } catch (e) {
        console.error('Error parsing VIN:', e);
      }
      break;
  }
  
  // Default: return the raw hex data
  return hexData;
};
