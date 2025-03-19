/**
 * OBD Utilities for working with OBD-II protocols and commands
 */

import { BluetoothOBDError, BluetoothErrorType } from './errorUtils';

// Standard OBD Protocol message terminator
const MSG_DELIMITER = '\r';

// Define supported OBD protocols
export enum OBDProtocol {
  AUTO = 0,
  J1850PWM = 1,
  J1850VPW = 2,
  ISO9141 = 3,
  ISO14230_4KW = 4,
  ISO14230_4ST = 5,
  ISO15765_11_500 = 6,
  ISO15765_29_500 = 7,
  ISO15765_11_250 = 8,
  ISO15765_29_250 = 9,
  SAE_J1939 = 10,
}

// Standard ELM327 commands
export const ELM_COMMANDS = {
  RESET: 'ATZ',
  ECHO_OFF: 'ATE0',
  LINEFEEDS_OFF: 'ATL0',
  SPACES_OFF: 'ATS0',
  HEADERS_OFF: 'ATH0',
  HEADERS_ON: 'ATH1',
  DESCRIBE_PROTOCOL: 'ATDP',
  DESCRIBE_PROTOCOL_NUMERIC: 'ATDPN',
  AUTO_PROTOCOL: 'ATSP0',
  SET_PROTOCOL_1: 'ATSP1',
  SET_PROTOCOL_2: 'ATSP2',
  SET_PROTOCOL_3: 'ATSP3',
  SET_PROTOCOL_4: 'ATSP4',
  SET_PROTOCOL_5: 'ATSP5',
  SET_PROTOCOL_6: 'ATSP6',
  SET_PROTOCOL_7: 'ATSP7',
  SET_PROTOCOL_8: 'ATSP8',
  SET_PROTOCOL_9: 'ATSP9',
  GET_PROTOCOL: 'ATDP',
  GET_VERSION: 'ATI',
  GET_DEVICE_DESCRIPTION: 'AT@1',
  GET_DEVICE_ID: 'AT@2',
  ADAPTIVE_TIMING_1: 'ATAT1',
  ADAPTIVE_TIMING_2: 'ATAT2',
  ADAPTIVE_TIMING_OFF: 'ATAT0',
  SET_TIMEOUT_VALUE: 'ATST',
  SET_BUS_INIT: 'ATBI',
  MONITOR_ALL: 'ATMA',
  VOLTAGE: 'ATRV',
};

// OBD-II Standard PIDs (Parameter IDs)
export const STANDARD_PIDS = {
  ENGINE_LOAD: { pid: '04', description: 'Engine Load', mode: 1, bytes: 1, formula: 'A/2.55' },
  ENGINE_COOLANT_TEMP: { pid: '05', description: 'Coolant Temperature', mode: 1, bytes: 1, formula: 'A-40' },
  ENGINE_RPM: { pid: '0C', description: 'Engine RPM', mode: 1, bytes: 2, formula: '((A*256)+B)/4' },
  VEHICLE_SPEED: { pid: '0D', description: 'Vehicle Speed', mode: 1, bytes: 1, formula: 'A' },
  INTAKE_AIR_TEMP: { pid: '0F', description: 'Intake Air Temperature', mode: 1, bytes: 1, formula: 'A-40' },
  THROTTLE_POSITION: { pid: '11', description: 'Throttle Position', mode: 1, bytes: 1, formula: 'A/2.55' },
  FUEL_LEVEL: { pid: '2F', description: 'Fuel Level', mode: 1, bytes: 1, formula: 'A/2.55' },
  FUEL_PRESSURE: { pid: '0A', description: 'Fuel Pressure', mode: 1, bytes: 1, formula: 'A*3' },
  TIMING_ADVANCE: { pid: '0E', description: 'Timing Advance', mode: 1, bytes: 1, formula: '(A-128)/2' },
  MAF_SENSOR: { pid: '10', description: 'MAF Sensor', mode: 1, bytes: 2, formula: '((A*256)+B)/100' },
  FUEL_PRESSURE_GAUGE: { pid: '23', description: 'Fuel Pressure (Gauge)', mode: 1, bytes: 1, formula: 'A*10' },
  AMBIENT_AIR_TEMP: { pid: '46', description: 'Ambient Air Temp', mode: 1, bytes: 1, formula: 'A-40' },
  OIL_TEMP: { pid: '5C', description: 'Engine Oil Temperature', mode: 1, bytes: 1, formula: 'A-40' },
  FUEL_RATE: { pid: '5E', description: 'Fuel Rate', mode: 1, bytes: 2, formula: '((A*256)+B)/20' },
  SUPPORTED_PIDS_01_20: { pid: '00', description: 'Supported PIDs [01-20]', mode: 1, bytes: 4, formula: 'N/A' },
  SUPPORTED_PIDS_21_40: { pid: '20', description: 'Supported PIDs [21-40]', mode: 1, bytes: 4, formula: 'N/A' },
  SUPPORTED_PIDS_41_60: { pid: '40', description: 'Supported PIDs [41-60]', mode: 1, bytes: 4, formula: 'N/A' },
  SUPPORTED_PIDS_61_80: { pid: '60', description: 'Supported PIDs [61-80]', mode: 1, bytes: 4, formula: 'N/A' },
  SUPPORTED_PIDS_81_A0: { pid: '80', description: 'Supported PIDs [81-A0]', mode: 1, bytes: 4, formula: 'N/A' },
  SUPPORTED_PIDS_A1_C0: { pid: 'A0', description: 'Supported PIDs [A1-C0]', mode: 1, bytes: 4, formula: 'N/A' },
  SUPPORTED_PIDS_C1_E0: { pid: 'C0', description: 'Supported PIDs [C1-E0]', mode: 1, bytes: 4, formula: 'N/A' },
  VIN: { pid: '02', description: 'Vehicle Identification Number (VIN)', mode: 9, bytes: 20, formula: 'N/A' },
};

// Modes for OBD-II commands
export enum OBD_MODES {
  CURRENT_DATA = '01',
  FREEZE_FRAME = '02',
  STORED_TROUBLE_CODES = '03',
  CLEAR_TROUBLE_CODES = '04',
  TEST_RESULTS_O2 = '05',
  TEST_RESULTS_OTHER = '06',
  PENDING_TROUBLE_CODES = '07',
  CONTROL_OPERATION = '08',
  REQUEST_VEHICLE_INFO = '09',
  PERMANENT_TROUBLE_CODES = '0A',
}

/**
 * Format a PID command to send to the OBD adapter
 * @param mode The mode (e.g. 01 for current data)
 * @param pid The PID (e.g. 0C for engine RPM)
 * @returns Formatted command
 */
export const formatPidCommand = (mode: number | string, pid: number | string): string => {
  // Ensure mode and PID are formatted as 2-digit hex strings
  const modeHex = typeof mode === 'number'
    ? mode.toString(16).padStart(2, '0').toUpperCase()
    : mode.toString().padStart(2, '0').toUpperCase();

  const pidHex = typeof pid === 'number'
    ? pid.toString(16).padStart(2, '0').toUpperCase()
    : pid.toString().padStart(2, '0').toUpperCase();

  return `${modeHex}${pidHex}`;
};

/**
 * Convert a PID response value to its actual meaning
 * @param data Hex data from the OBD adapter
 * @param command The command that was sent
 * @returns Converted value or the original data if conversion fails
 */
export const convertPidValue = (
  data: string,
  command: string,
): number | string | null => {
  try {
    if (!data || !command) {
      return null;
    }

    // Convert response to uppercase and remove whitespace
    data = data.toUpperCase().replace(/\s+/g, '');
    command = command.toUpperCase().replace(/\s+/g, '');

    // Extract mode and PID from command
    // E.g., "010C" -> mode = "01", pid = "0C"
    if (command.length < 4) {
      return data; // Invalid command format
    }

    const mode = command.substring(0, 2);
    const pid = command.substring(2, 4);

    // Check if response contains "NO DATA" or similar error
    if (
      data.includes('NODATA') ||
      data.includes('ERROR') ||
      data.includes('UNABLETOCONNECT') ||
      data.includes('STOPPED')
    ) {
      return null;
    }

    // Some responses include the mode+40 and PID in the response
    // For example, response to "010C" might start with "410C"
    // We need to skip this part to get to the data
    const responseMode = parseInt(mode, 16) + 0x40;
    const responseModeHex = responseMode.toString(16).toUpperCase();

    // Try to find where the actual data starts
    let dataStartIndex = -1;

    // Check if the response starts with the response mode and PID
    if (data.startsWith(responseModeHex + pid)) {
      dataStartIndex = 4;
    } 
    // Or try with the original mode and PID
    else if (data.startsWith(mode + pid)) {
      dataStartIndex = 4;
    }
    // If the response is just raw data bytes with no mode/PID
    else {
      dataStartIndex = 0;
    }

    if (dataStartIndex < 0) {
      return data; // Can't find data portion
    }

    // Extract just the data bytes
    const dataBytes = data.substring(dataStartIndex);

    // Now apply the conversion formula based on PID
    switch (`${mode}${pid}`) {
      // Mode 01 PIDs
      case '010C': // Engine RPM
        if (dataBytes.length >= 4) {
          const a = parseInt(dataBytes.substring(0, 2), 16);
          const b = parseInt(dataBytes.substring(2, 4), 16);
          return ((a * 256) + b) / 4;
        }
        break;

      case '010D': // Vehicle Speed
        if (dataBytes.length >= 2) {
          return parseInt(dataBytes.substring(0, 2), 16);
        }
        break;

      case '0105': // Coolant Temperature
        if (dataBytes.length >= 2) {
          return parseInt(dataBytes.substring(0, 2), 16) - 40;
        }
        break;

      case '0104': // Engine Load
        if (dataBytes.length >= 2) {
          return parseInt(dataBytes.substring(0, 2), 16) * 100 / 255;
        }
        break;

      case '010B': // Intake Manifold Pressure
        if (dataBytes.length >= 2) {
          return parseInt(dataBytes.substring(0, 2), 16);
        }
        break;

      case '010F': // Intake Air Temperature
        if (dataBytes.length >= 2) {
          return parseInt(dataBytes.substring(0, 2), 16) - 40;
        }
        break;

      case '0111': // Throttle Position
        if (dataBytes.length >= 2) {
          return parseInt(dataBytes.substring(0, 2), 16) * 100 / 255;
        }
        break;

      case '012F': // Fuel Level
        if (dataBytes.length >= 2) {
          return parseInt(dataBytes.substring(0, 2), 16) * 100 / 255;
        }
        break;

      case '0110': // MAF Air Flow Rate
        if (dataBytes.length >= 4) {
          const a = parseInt(dataBytes.substring(0, 2), 16);
          const b = parseInt(dataBytes.substring(2, 4), 16);
          return ((a * 256) + b) / 100;
        }
        break;

      case '0142': // Control Module Voltage
        if (dataBytes.length >= 4) {
          const a = parseInt(dataBytes.substring(0, 2), 16);
          const b = parseInt(dataBytes.substring(2, 4), 16);
          return ((a * 256) + b) / 1000;
        }
        break;

      case '0146': // Ambient Air Temperature
        if (dataBytes.length >= 2) {
          return parseInt(dataBytes.substring(0, 2), 16) - 40;
        }
        break;

      case '015C': // Oil Temperature
        if (dataBytes.length >= 2) {
          return parseInt(dataBytes.substring(0, 2), 16) - 40;
        }
        break;

      case '015E': // Fuel Rate
        if (dataBytes.length >= 4) {
          const a = parseInt(dataBytes.substring(0, 2), 16);
          const b = parseInt(dataBytes.substring(2, 4), 16);
          return ((a * 256) + b) / 20;
        }
        break;
        
      // Mode 09 PIDs - Vehicle Information
      case '0902': // VIN (Vehicle Identification Number)
        // VIN responses use a multi-line format that varies by adapter
        // This is a simplified parsing, may need adaptation for specific adapters
        try {
          // Strip out any non-alphanumeric characters
          const vinChars = dataBytes.replace(/[^A-Z0-9]/g, '');
          
          // A typical VIN is 17 characters
          if (vinChars.length >= 17) {
            return vinChars.substring(0, 17);
          }
          
          // If we don't have enough characters, just return what we have
          return vinChars;
        } catch {
          return data;
        }

      default:
        // For any PID we don't specifically handle, just return the data
        return dataBytes;
    }

    // If we reach here, something went wrong with the parsing
    return data;
  } catch (error) {
    console.warn('Error parsing PID value:', error);
    return data;
  }
};

/**
 * Parse OBD trouble codes from DTC response
 * @param dtcResponse The response from the OBD adapter for trouble code request (Mode 03)
 * @returns Array of trouble codes
 */
export const parseDTCResponse = (dtcResponse: string): string[] => {
  try {
    if (!dtcResponse || dtcResponse.includes('NO DATA')) {
      return [];
    }

    // Extract all hex bytes from the response
    const hexMatches = dtcResponse.toUpperCase().match(/[0-9A-F]{2}/g) || [];
    if (hexMatches.length < 2) {
      return [];
    }

    // Skip mode response value (e.g., 43) and count byte
    const bytes = hexMatches.slice(2);
    const codes: string[] = [];

    // Process bytes in pairs to form DTC codes
    for (let i = 0; i < bytes.length; i += 2) {
      if (i + 1 >= bytes.length) break;

      const firstByte = parseInt(bytes[i], 16);
      const secondByte = parseInt(bytes[i + 1], 16);

      if (firstByte === 0 && secondByte === 0) continue;

      // First byte high nibble determines code type
      let prefix: string;
      switch (firstByte >> 6) {
        case 0:
          prefix = 'P0'; // Powertrain
          break;
        case 1:
          prefix = 'C0'; // Chassis
          break;
        case 2:
          prefix = 'B0'; // Body
          break;
        case 3:
          prefix = 'U0'; // Network
          break;
        default:
          prefix = 'P0';
      }

      // Combine the rest to form the code
      const suffix = (((firstByte & 0x3F) << 8) | secondByte).toString(16).toUpperCase().padStart(3, '0');
      codes.push(prefix + suffix);
    }

    return codes;
  } catch (error) {
    console.error('Error parsing DTC response:', error);
    return [];
  }
};

/**
 * Extract the response value from a raw OBD response
 * @param response Raw response from OBD adapter
 * @param command Command that was sent
 * @returns Extracted value, or null if response is invalid
 */
export const extractResponseValue = (response: string, command: string): string | null => {
  // Remove whitespace and convert to uppercase
  const cleanResponse = response.replace(/\s+/g, '').toUpperCase();
  const cleanCommand = command.replace(/\s+/g, '').toUpperCase();

  // Check for error responses
  if (
    cleanResponse.includes('NODATA') ||
    cleanResponse.includes('ERROR') ||
    cleanResponse.includes('UNABLETOCONNECT') ||
    cleanResponse.includes('STOPPED')
  ) {
    return null;
  }

  // If the command is just 2 characters (e.g. "AT" commands), return the whole response
  if (cleanCommand.length <= 2) {
    return cleanResponse;
  }

  // For regular OBD commands, try to extract just the data part
  try {
    const mode = cleanCommand.substring(0, 2);
    
    // For Mode 01-09 commands, expect a response with Mode+40 prefix
    if (mode >= '01' && mode <= '09') {
      const responseMode = (parseInt(mode, 16) + 0x40).toString(16).toUpperCase();
      
      // If it's just a mode command (e.g. "01"), return the whole response
      if (cleanCommand.length === 2) {
        return cleanResponse;
      }
      
      // Otherwise, it's a mode+PID command
      const pid = cleanCommand.substring(2);
      
      // Look for the response prefix (e.g. "410C" for command "010C")
      const prefix = responseMode + pid;
      if (cleanResponse.includes(prefix)) {
        // Return everything after the prefix
        return cleanResponse.substring(cleanResponse.indexOf(prefix) + prefix.length);
      }
    }
    
    // If all else fails, just return the raw response
    return cleanResponse;
  } catch {
    return cleanResponse;
  }
};

/**
 * Check if a PID is supported by the vehicle
 * @param supportedPidsResponse Response from the "supported PIDs" command (e.g., 0100)
 * @param pid PID to check, e.g. "0C" for RPM
 * @returns True if the PID is supported
 */
export const isPidSupported = (supportedPidsResponse: string, pid: string): boolean => {
  try {
    // Extract the 4 data bytes from the supported PIDs response
    const hexData = extractResponseValue(supportedPidsResponse, '0100');
    if (!hexData || hexData.length < 8) {
      return false;
    }

    // Convert the 4 bytes to a 32-bit integer
    const supportedBits = parseInt(hexData, 16);
    
    // The bits correspond to PIDs 01 through 20
    // PID 01 = bit 31 (leftmost), PID 20 = bit 0 (rightmost)
    const pidNumber = parseInt(pid, 16);
    
    // The bit position is (32 - pidNumber)
    const bitPosition = 32 - pidNumber;
    
    // Check if the bit is set
    return (supportedBits & (1 << bitPosition)) !== 0;
  } catch (error) {
    console.error('Error checking if PID is supported:', error);
    return false;
  }
};

/**
 * ECU connector interface
 */
export interface ECUConnector {
  sendCommand(command: string, timeoutMs?: number): Promise<string>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Create a command with carriage return
 */
export const createCommand = (command: string): string => {
  return command.endsWith('\r') ? command : `${command}\r`;
};

/**
 * Parse the response from protocol query
 */
export const parseProtocolResponse = (response: string): string => {
  // Clean response and convert to uppercase for consistency
  const cleanResponse = response.trim().toUpperCase();

  // Handle different response formats
  if (cleanResponse.length === 1) {
    return cleanResponse;
  }

  if (cleanResponse.length === 2) {
    return cleanResponse[0];
  }

  // Find protocol ID in descriptive response
  const protocolMap: Record<string, string> = {
    'ISO 15765-4 (CAN 11/500)': '6',
    'ISO 15765-4 (CAN 29/500)': '7',
    'ISO 15765-4 (CAN 11/250)': '8',
    'ISO 15765-4 (CAN 29/250)': '9',
    'ISO 14230-4 (KWP 5BAUD)': '4',
    'ISO 14230-4 (KWP FAST)': '5',
    'ISO 9141-2': '3',
    'SAE J1850 VPW': '2',
    'SAE J1850 PWM': '1'
  };

  for (const [key, value] of Object.entries(protocolMap)) {
    if (cleanResponse.includes(key)) {
      return value;
    }
  }

  // Handle AUTO responses
  if (cleanResponse.startsWith('AUTO')) {
    // Extract protocol from AUTO response
    for (const [key, value] of Object.entries(protocolMap)) {
      if (cleanResponse.includes(key)) {
        return value;
      }
    }
  }

  return 'UNKNOWN';
};

/**
 * Determine OBD protocol from code
 */
export const determineOBDProtocol = (code: string): string => {
  const protocolMap: Record<string, string> = {
    '1': 'ISO_15765_4_CAN_11_500',
    '2': 'ISO_15765_4_CAN_29_500',
    '3': 'ISO_15765_4_CAN_11_250',
    '4': 'ISO_15765_4_CAN_29_250',
    '5': 'ISO_14230_4_KWP_5_BAUD',
    '6': 'ISO_14230_4_KWP_FAST',
    '7': 'ISO_9141_2',
    '8': 'SAE_J1850_VPW',
    '9': 'SAE_J1850_PWM',
    'A': 'ISO15765_29_500',
    'B': 'USER1_CAN',
    'C': 'USER2_CAN',
  };

  return protocolMap[code] || 'AUTO';
};

/**
 * Evaluate initialization status from responses
 */
export const evaluateInitializationStatus = (responses: string[]): boolean => {
  if (responses.length < 2) return false;

  // Check for any error responses
  const hasErrors = responses.some(response => {
    const cleanResponse = response.trim().toUpperCase();
    return (
      cleanResponse.includes('ERROR') ||
      cleanResponse.includes('UNABLE TO CONNECT') ||
      cleanResponse.includes('NO DATA')
    );
  });

  return !hasErrors;
};

/**
 * Create an ECU connector that returns raw responses
 * @param baseConnector The base connector to wrap
 * @returns An ECU connector that returns raw responses
 */
export const createRawECUConnector = (baseConnector: ECUConnector): ECUConnector => {
  return {
    sendCommand: async (command: string, timeoutMs?: number): Promise<string> => {
      const response = await baseConnector.sendCommand(command, timeoutMs);
      return response;
    },
    disconnect: () => baseConnector.disconnect(),
    isConnected: () => baseConnector.isConnected(),
  };
};

/**
 * Create an ECU connector that decodes responses based on the command
 * @param baseConnector The base connector to wrap
 * @returns An ECU connector that decodes responses
 */
export const createDecodedECUConnector = (baseConnector: ECUConnector): ECUConnector => {
  return {
    sendCommand: async (command: string, timeoutMs?: number): Promise<string> => {
      const response = await baseConnector.sendCommand(command, timeoutMs);
      const extractedValue = extractResponseValue(response, command);
      if (extractedValue === null) {
        throw new BluetoothOBDError(BluetoothErrorType.INVALID_RESPONSE, 'Invalid OBD response');
      }
      
      // If this is a PID command (mode 01-09), try to convert the value
      if (command.length >= 4 && /^[0-9A-Fa-f]{4,}$/.test(command)) {
        const convertedValue = convertPidValue(extractedValue, command);
        if (convertedValue !== null) {
          return convertedValue.toString();
        }
      }
      
      return extractedValue;
    },
    disconnect: () => baseConnector.disconnect(),
    isConnected: () => baseConnector.isConnected(),
  };
};
