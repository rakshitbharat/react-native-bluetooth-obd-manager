import { decodeData } from './dataUtils';

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
  SAE_J1939 = 10
}

// ELM327 command constants
export const ELM_COMMANDS = {
  RESET: 'ATZ',
  READ_VOLTAGE: 'AT RV',
  PROTOCOL_CLOSE: 'ATPC',
  GET_PROTOCOL: 'ATDPN',
  AUTO_PROTOCOL: 'ATSP0',
  TRY_PROTOCOL_PREFIX: 'ATTP',
  SET_PROTOCOL_PREFIX: 'ATSP',
  LINEFEEDS_OFF: 'ATL0',
  SPACES_OFF: 'ATS0',
  HEADERS_OFF: 'ATH0',
  ECHO_OFF: 'ATE0',
  ADAPTIVE_TIMING_2: 'ATAT2'
};

// Response identifiers
export const RSP_ID = {
  PROMPT: '>',
  OK: 'OK',
  MODEL: 'ELM327',
  NODATA: 'NO DATA',
  ERROR: 'ERROR',
  NOCONN: 'UNABLE TO CONNECT',
  CANERROR: 'CAN ERROR',
  BUSERROR: 'BUS ERROR',
  BUSINIERR: 'BUS INIT: ERROR',
  BUSBUSY: 'BUS BUSY',
  STOPPED: 'STOPPED',
  SEARCHING: 'SEARCHING...'
};

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
  PERMACODES: 0x0a
};

// Standard PIDs for OBD-II
export const STANDARD_PIDS = {
  ENGINE_RPM: '010C',
  VEHICLE_SPEED: '010D',
  ENGINE_COOLANT_TEMP: '0105',
  THROTTLE_POS: '0111',
  INTAKE_MAP: '010B',
  MAF_SENSOR: '0110',
  O2_SENSORS: '0113',
  OBD_STANDARDS: '011C',
  VIN: '0902'
};

// Interface for ECU connector
export interface ECUConnector {
  isRawResponseEnabled: boolean;
  sendCommand(command: string, fireRaw?: boolean): Promise<string>;
  getLastResponse(): Promise<string>;
  getRawResponse(): Promise<number[] | null>;
}

/**
 * Creates a raw data ECU connector
 * @param sendCommandFn Function to send commands to the device
 * @returns ECU connector that returns raw data
 */
export const createRawECUConnector = (
  sendCommandFn: (command: string) => Promise<string>
): ECUConnector => createECUConnector(sendCommandFn, true);

/**
 * Creates a decoded data ECU connector
 * @param sendCommandFn Function to send commands to the device
 * @returns ECU connector that returns decoded data
 */
export const createDecodedECUConnector = (
  sendCommandFn: (command: string) => Promise<string>
): ECUConnector => createECUConnector(sendCommandFn, false);

/**
 * Creates an ECU connector with specified response mode
 * @param sendCommandFn Function to send commands to the device
 * @param setRawResponse Whether to return raw responses
 * @returns Configured ECU connector
 */
export const createECUConnector = (
  sendCommandFn: (command: string) => Promise<string>,
  setRawResponse = false
): ECUConnector => {
  // Buffer to store the raw response
  let rawResponseBuffer: number[] | null = null;
  
  // Handler to save raw response data
  const handleRawResponse = (data: number[]) => {
    rawResponseBuffer = data;
  };

  return {
    isRawResponseEnabled: setRawResponse,

    async sendCommand(command: string, fireRaw = false): Promise<string> {
      try {
        // Reset raw buffer before sending new command
        rawResponseBuffer = null;
        
        // Send command and get response
        const response = await sendCommandFn(command);
        
        // Return appropriate response format
        return response;
      } catch (error) {
        console.error('ECU command failed:', error);
        return 'COMMAND_FAILED';
      }
    },

    async getLastResponse(): Promise<string> {
      const rawResponse = await this.getRawResponse();
      if (this.isRawResponseEnabled) {
        return rawResponse ? JSON.stringify(rawResponse) : '';
      }
      return rawResponse ? decodeData(rawResponse) : '';
    },

    async getRawResponse(): Promise<number[] | null> {
      return rawResponseBuffer;
    }
  };
};
