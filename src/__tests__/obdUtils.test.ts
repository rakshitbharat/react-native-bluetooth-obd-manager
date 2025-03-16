import { 
  ELM_COMMANDS,
  STANDARD_PIDS,
  determineOBDProtocol,
  parseProtocolResponse,
  evaluateInitializationStatus
} from '../utils/obdUtils';

describe('obdUtils', () => {
  describe('ELM_COMMANDS constants', () => {
    it('should define all ELM initialization commands', () => {
      expect(ELM_COMMANDS.RESET).toBe('ATZ');
      expect(ELM_COMMANDS.ECHO_OFF).toBe('ATE0');
      expect(ELM_COMMANDS.LINEFEEDS_OFF).toBe('ATL0');
      expect(ELM_COMMANDS.HEADERS_OFF).toBe('ATH0');
      expect(ELM_COMMANDS.SPACES_OFF).toBe('ATS0');
      expect(ELM_COMMANDS.AUTO_PROTOCOL).toBe('ATSP0');
      expect(ELM_COMMANDS.ADAPTIVE_TIMING_2).toBe('ATAT2');
      expect(ELM_COMMANDS.GET_PROTOCOL).toBe('ATDPN');
    });
  });

  describe('STANDARD_PIDS constants', () => {
    it('should define standard mode 01 PIDs', () => {
      expect(STANDARD_PIDS.ENGINE_RPM).toBe('010C');
      expect(STANDARD_PIDS.VEHICLE_SPEED).toBe('010D');
      expect(STANDARD_PIDS.ENGINE_COOLANT_TEMP).toBe('0105');
      expect(STANDARD_PIDS.INTAKE_AIR_TEMP).toBe('010F');
    });
  });

  describe('determineOBDProtocol', () => {
    it('should map protocol code to OBDProtocol enum', () => {
      expect(determineOBDProtocol('1')).toBe('ISO_15765_4_CAN_11_500');
      expect(determineOBDProtocol('2')).toBe('ISO_15765_4_CAN_29_500');
      expect(determineOBDProtocol('3')).toBe('ISO_15765_4_CAN_11_250');
      expect(determineOBDProtocol('4')).toBe('ISO_15765_4_CAN_29_250');
      expect(determineOBDProtocol('5')).toBe('ISO_14230_4_KWP_5_BAUD');
      expect(determineOBDProtocol('6')).toBe('ISO_14230_4_KWP_FAST');
      expect(determineOBDProtocol('7')).toBe('ISO_9141_2');
      expect(determineOBDProtocol('8')).toBe('SAE_J1850_VPW');
      expect(determineOBDProtocol('9')).toBe('SAE_J1850_PWM');
      expect(determineOBDProtocol('A')).toBe('ISO15765_29_500');
      expect(determineOBDProtocol('B')).toBe('USER1_CAN');
      expect(determineOBDProtocol('C')).toBe('USER2_CAN');
      expect(determineOBDProtocol('UNKNOWN')).toBe('AUTO');
    });
  });

  describe('parseProtocolResponse', () => {
    it('should extract protocol code from ELM response', () => {
      expect(parseProtocolResponse('A7')).toBe('A');
      expect(parseProtocolResponse('6')).toBe('6');
      expect(parseProtocolResponse('AUTO, ISO 15765-4 (CAN 11/500)')).toBe('1');
      expect(parseProtocolResponse('AUTO, SAE J1850 PWM')).toBe('9');
      expect(parseProtocolResponse('Invalid protocol')).toBe('UNKNOWN');
    });
  });

  describe('evaluateInitializationStatus', () => {
    it('should determine if ELM initialization succeeded', () => {
      expect(evaluateInitializationStatus(['OK', 'OK', 'OK', 'OK', 'A7', 'ELM327 v1.5'])).toBe(true);
      expect(evaluateInitializationStatus(['OK', 'OK', 'ERROR', 'OK', 'A7', 'ELM327 v1.5'])).toBe(false);
      expect(evaluateInitializationStatus(['UNABLE TO CONNECT', 'OK', 'OK', 'OK', 'A7'])).toBe(false);
    });
    
    it('should reject empty or incomplete response arrays', () => {
      expect(evaluateInitializationStatus([])).toBe(false);
      expect(evaluateInitializationStatus(['OK'])).toBe(false);
    });
  });
});
