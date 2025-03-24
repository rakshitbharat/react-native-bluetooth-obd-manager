import {
  extractResponseValue,
  isPidSupported
} from '../../utils/obdUtils';

describe('obdUtils', () => {
  describe('extractResponseValue', () => {
    test('should extract value from standard OBD response', () => {
      const response = '410C1AF8';
      const command = '010C';
      const result = extractResponseValue(response, command);
      expect(result).toBe('1AF8');
    });

    test('should handle responses with whitespace', () => {
      const response = '41 0C 1A F8\r\n';
      const command = '010C';
      const result = extractResponseValue(response, command);
      expect(result).toBe('1AF8');
    });

    test('should handle responses with prompt character', () => {
      const response = '41 0C 1A F8>';
      const command = '010C';
      const result = extractResponseValue(response, command);
      expect(result).toBe('1AF8');
    });

    test('should return null for error responses', () => {
      expect(extractResponseValue('NO DATA', '010C')).toBeNull();
      expect(extractResponseValue('ERROR', '010C')).toBeNull();
      expect(extractResponseValue('UNABLE TO CONNECT', '010C')).toBeNull();
      expect(extractResponseValue('STOPPED', '010C')).toBeNull();
    });

    test('should return raw response when mode command is AT', () => {
      const response = 'ELM327 v1.5\r\nOK>';
      const command = 'ATZ';
      const result = extractResponseValue(response, command);
      expect(result).toBe('ELM327V1.5OK');
    });

    test('should handle different modes with corresponding responses', () => {
      // Mode 01 (current data)
      expect(extractResponseValue('410D32', '010D')).toBe('32');
      
      // Mode 02 (freeze frame)
      expect(extractResponseValue('420552', '0205')).toBe('52');
      
      // Mode 03 (DTCs)
      expect(extractResponseValue('43010203040506', '03')).toBe('010203040506');
      
      // Mode 09 (vehicle info)
      expect(extractResponseValue('4902012141', '0902')).toBe('012141');
    });

    test('should return original response when prefix is not found', () => {
      const response = 'SEARCHING...';
      const command = '010C';
      const result = extractResponseValue(response, command);
      expect(result).toBe('SEARCHING...');
    });
    
    test('should handle command with mode only', () => {
      const response = '4100BE3EB811';
      const command = '01';
      const result = extractResponseValue(response, command);
      expect(result).toBe('4100BE3EB811');
    });

    test('should handle case sensitivity', () => {
      const response = '410c1af8';
      const command = '010C';
      const result = extractResponseValue(response, command);
      expect(result).toBe('1af8');
    });

    test('should handle responses with command echo', () => {
      const response = '010C410C1AF8';
      const command = '010C';
      const result = extractResponseValue(response, command);
      expect(result).toBe('1AF8');
    });

    test('should handle empty input', () => {
      expect(extractResponseValue('', '010C')).toBeNull();
      expect(extractResponseValue('NO DATA', '')).toBeNull();
    });
  });

  describe('isPidSupported', () => {
    test('should correctly identify supported PIDs from bitmap', () => {
      // This is a sample bitmap supporting PIDs 01, 03, 04, 05, 0C, 0D, 11, 13, 15, 1C
      const supportedPidsResponse = '4100BE3EB811';
      
      // Should be supported
      expect(isPidSupported(supportedPidsResponse, '01')).toBe(true);
      expect(isPidSupported(supportedPidsResponse, '0C')).toBe(true);
      expect(isPidSupported(supportedPidsResponse, '0D')).toBe(true);
      
      // Should not be supported
      expect(isPidSupported(supportedPidsResponse, '02')).toBe(false);
      expect(isPidSupported(supportedPidsResponse, '06')).toBe(false);
      expect(isPidSupported(supportedPidsResponse, '1F')).toBe(false);
    });

    test('should handle invalid input', () => {
      expect(isPidSupported('INVALID', '0C')).toBe(false);
      expect(isPidSupported('', '0C')).toBe(false);
      expect(isPidSupported('4100BE3EB811', '')).toBe(false);
    });
  });

  // Additional tests for other functions can be added below
});
