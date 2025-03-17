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

/**
 * Create a string command with carriage return
 */
export const createCommand = (command: string): string => {
  return command.endsWith(MSG_DELIMITER) ? command : `${command}${MSG_DELIMITER}`;
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
    'SAE J1850 PWM': '1',
    'SAE J1850 VPW': '2',
    'ISO 9141-2': '3',
    'ISO 14230-4 (KWP 5BAUD)': '4',
    'ISO 14230-4 (KWP FAST)': '5',
    'ISO 15765-4 (CAN 11/500)': '6',
    'ISO 15765-4 (CAN 29/500)': '7',
    'ISO 15765-4 (CAN 11/250)': '8',
    'ISO 15765-4 (CAN 29/250)': '9',
    'SAE J1939 (CAN 29/250)': 'A',
  };

  for (const [key, value] of Object.entries(protocolMap)) {
    if (cleanResponse.includes(key)) {
      return value;
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
