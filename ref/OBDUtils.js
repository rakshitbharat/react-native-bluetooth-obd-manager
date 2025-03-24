import {byteArrayToString as decodeValue} from '@src/helper/OBDManagerHelper/ECUConnector/decoder/lib/utils';
import BLEDataReceiver from '@src/helper/OBDManagerHelper/BLEDataReceiver';
import protocolConfig from '../../config/protocolConfig';
import {log as logMain} from '@src/utils/logs';

export const log = (...args) => {
  logMain(...args);
};

const logOBDUtils = (...args) => {
  if (typeof args[1] === 'string') {
    args[1] = `[OBDUtils] ${args[1]}`;
  }
  logMain(...args);
};

// Create dedicated connector types
export const createRawECUConnector = obdMonitor => createECUConnector(obdMonitor, true);
export const createDecodedECUConnector = obdMonitor => createECUConnector(obdMonitor, false);

export const createECUConnector = (obdMonitor, setRawResponse = false) => {
  return {
    isRawResponseEnabled: setRawResponse,

    async sendCommand(command, fireRaw = false) {
      try {
        await obdMonitor.writeCommand(command, fireRaw);
        const response = await this.getLastResponse();
        return response;
      } catch (error) {
        return 'COMMAND_FAILED';
      }
    },

    async getLastResponse() {
      const rawResponse = await this.getRawResponse();
      if (this.isRawResponseEnabled) return rawResponse;
      return rawResponse ? decodeValue(rawResponse).trim() : '';
    },

    getRawResponse() {
      return BLEDataReceiver?.rawCompleteResponse;
    }
  };
};

// Protocol-related configurations
export const PROT = {
  AUTO: 0,
  J1850PWM: 1,
  J1850VPW: 2,
  ISO9141: 3,
  ISO14230_4KW: 4,
  ISO14230_4ST: 5,
  ISO15765_11_500: 6,
  ISO15765_29_500: 7,
  ISO15765_11_250: 8,
  ISO15765_29_250: 9,
  SAE_J1939: 10
};

// ELM command configurations
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

// OBD Service codes
export const OBD_SVC = {
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
