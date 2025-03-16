import { decodeData, formatResponse, isResponseComplete } from './dataUtils';
import { BluetoothErrorType, BluetoothOBDError } from './errorUtils';

// Define OBD protocols
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

// ELM327 command definitions
export const ELM_COMMANDS = {
  RESET: 'ATZ',
  ECHO_OFF: 'ATE0',
  LINEFEEDS_OFF: 'ATL0',
  HEADERS_OFF: 'ATH0',
  SPACES_OFF: 'ATS0',
  DESCRIBE_PROTOCOL: 'ATDP',
  DESCRIBE_PROTOCOL_NUMBER: 'ATDPN',
  READ_VOLTAGE: 'ATRV',
  SET_PROTOCOL: 'ATSP',
  AUTO_PROTOCOL: 'ATSP0',
  ADAPTIVE_TIMING_0: 'ATAT0',
  ADAPTIVE_TIMING_1: 'ATAT1',
  ADAPTIVE_TIMING_2: 'ATAT2',
  ALL_PROG_PARAMS: 'ATPP FF OFF',
  TIMEOUT: 'ATST',
  TRY_PROTOCOL: 'ATTP',
  GET_PROTOCOL: 'ATDPN',
};

// Response status identifiers
export enum RSP_ID {
  OK = 'OK',
  SEARCHING = 'SEARCHING...',
  NO_DATA = 'NO DATA',
  ERROR = 'ERROR',
  UNABLE_TO_CONNECT = 'UNABLE TO CONNECT',
  CAN_ERROR = 'CAN ERROR',
  STOPPED = 'STOPPED',
  BUFFER_FULL = 'BUFFER FULL',
}

// OBD Service modes
export const OBD_SERVICE_MODES = {
  NONE: 0x00,
  DATA: 0x01,
  FREEZEFRAME: 0x02,
  READ_CODES: 0x03,
  CLEAR_CODES: 0x04,
  O2_RESULT: 0x05,
  MON_RESULT: 0x06,
  PENDINGCODES: 0x07,
  CTRL_MODE: 0x08,
  VEH_INFO: 0x09,
  PERMACODES: 0x0a,
};

// Standard PIDs for OBD-II
export const STANDARD_PIDS = {
  SUPPORTED_PIDS_1_20: '0100',
  MONITOR_STATUS: '0101',
  ENGINE_RPM: '010C',
  VEHICLE_SPEED: '010D',
  MAF_SENSOR: '0110',
  O2_SENSORS: '0113',
  OBD_STANDARDS: '011C',
  SUPPORTED_PIDS_21_40: '0120',
  THROTTLE_POS: '0111',
  ENGINE_COOLANT_TEMP: '0105',
  FUEL_PRESSURE: '010A',
  INTAKE_MAP: '010B',
  TIMING_ADVANCE: '010E',
  INTAKE_TEMP: '010F',
  FUEL_SYSTEM_STATUS: '0103',
  FUEL_LEVEL: '012F',
  BAROMETRIC_PRESSURE: '0133',
  CONTROL_MODULE_VOLTAGE: '0142',
  ABS_ENGINE_LOAD: '0143',
  AMBIENT_TEMP: '0146',
  VIN: '0902',
};

// ECU response end markers
const END_OF_MSG = '>';

export interface ECUConnector {
  sendCommand(command: string, timeoutMs?: number): Promise<string>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Create a raw ECU connector that doesn't process responses
 */
export const createRawECUConnector = (
  sendCommandFn: (command: string, timeoutMs?: number) => Promise<string>,
): ECUConnector => {
  return {
    sendCommand: sendCommandFn,
    disconnect: async () => {
      try {
        await sendCommandFn(ELM_COMMANDS.RESET);
      } catch (error) {
        // Ignore reset errors during disconnect
      }
    },
    isConnected: () => true,
  };
};

/**
 * Create a decoded ECU connector that processes responses
 */
export const createDecodedECUConnector = (
  sendCommandFn: (command: string, timeoutMs?: number) => Promise<string>,
): ECUConnector => {
  let responseBuffer = '';
  let lastCommand: string | null = null;

  const processResponse = (response: string): string => {
    // Add to buffer
    responseBuffer += response;

    // Check if response is complete
    if (isResponseComplete(responseBuffer)) {
      const completeResponse = formatResponse(responseBuffer, lastCommand || '');
      responseBuffer = '';
      return completeResponse;
    }

    throw new BluetoothOBDError(
      BluetoothErrorType.WRITE_ERROR,
      'Incomplete response'
    );
  };

  return {
    sendCommand: async (command: string, timeoutMs?: number) => {
      lastCommand = command;
      const rawResponse = await sendCommandFn(command, timeoutMs);
      return processResponse(rawResponse);
    },
    disconnect: async () => {
      try {
        await sendCommandFn(ELM_COMMANDS.RESET);
      } catch (error) {
        // Ignore reset errors during disconnect
      }
      responseBuffer = '';
      lastCommand = null;
    },
    isConnected: () => true,
  };
};
