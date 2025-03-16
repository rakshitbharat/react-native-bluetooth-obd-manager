import { 
  decodeData, 
  encodeCommand, 
  isResponseComplete, 
  formatResponse,
  extractValueFromResponse,
  parseOBDResponse
} from '../utils/dataUtils';

describe('dataUtils', () => {
  describe('encodeCommand', () => {
    it('should encode command strings to byte arrays', () => {
      const command = 'ATZ\r';
      const result = encodeCommand(command);

      // Expected bytes for 'ATZ\r'
      expect(result).toEqual([65, 84, 90, 13]);
    });
    
    it('should handle empty strings', () => {
      expect(encodeCommand('')).toEqual([]);
    });
    
    it('should handle special characters', () => {
      expect(encodeCommand('AT@1\r')).toEqual([65, 84, 64, 49, 13]);
    });
  });

  describe('decodeData', () => {
    it('should decode byte arrays to strings', () => {
      const bytes = [69, 76, 77, 51, 50, 55, 32, 118, 49, 46, 53, 13, 62];
      const result = decodeData(bytes);

      // 'ELM327 v1.5\r>'
      expect(result).toBe('ELM327 v1.5\r>');
    });
    
    it('should handle empty byte arrays', () => {
      expect(decodeData([])).toBe('');
    });
  });

  describe('isResponseComplete', () => {
    it('should identify complete responses with prompt character', () => {
      const response = 'ELM327 v1.5\r>';
      expect(isResponseComplete(response)).toBe(true);
    });

    it('should identify incomplete responses', () => {
      const response = 'ELM327 v1.5\r';
      expect(isResponseComplete(response)).toBe(false);
    });
    
    it('should handle empty responses', () => {
      expect(isResponseComplete('')).toBe(false);
    });
    
    it('should handle responses with just the prompt', () => {
      expect(isResponseComplete('>')).toBe(true);
    });
  });

  describe('formatResponse', () => {
    it('should clean up OBD responses by removing echo and prompt', () => {
      const response = 'ATZ\rELM327 v1.5\r>';
      const command = 'ATZ';
      const result = formatResponse(response, command);

      expect(result).toBe('ELM327 v1.5');
    });
    
    it('should handle responses without echo', () => {
      const response = 'ELM327 v1.5\r>';
      const command = 'ATZ';
      const result = formatResponse(response, command);
      
      expect(result).toBe('ELM327 v1.5');
    });
    
    it('should handle responses with multiple lines', () => {
      const response = 'ATZ\rELM327 v1.5\rOK\r>';
      const command = 'ATZ';
      const result = formatResponse(response, command);
      
      expect(result).toBe('ELM327 v1.5\rOK');
    });
    
    it('should handle NO DATA responses', () => {
      const response = '0100\rNO DATA\r>';
      const command = '0100';
      const result = formatResponse(response, command);
      
      expect(result).toBe('NO DATA');
    });
    
    it('should handle empty responses', () => {
      const response = '\r>';
      const command = 'ATZ';
      const result = formatResponse(response, command);
      
      expect(result).toBe('');
    });
  });

  describe('extractValueFromResponse', () => {
    it('should extract hex value from OBD response', () => {
      expect(extractValueFromResponse('41 0C 1A F8')).toBe('1AF8');
      expect(extractValueFromResponse('41 04 05')).toBe('05');
    });
    
    it('should return null for invalid responses', () => {
      expect(extractValueFromResponse('NO DATA')).toBeNull();
      expect(extractValueFromResponse('ERROR')).toBeNull();
      expect(extractValueFromResponse('UNABLE TO CONNECT')).toBeNull();
    });
  });

  describe('parseOBDResponse', () => {
    it('should parse standard mode 01 responses', () => {
      // RPM (Mode 01, PID 0C): ((A*256)+B)/4
      expect(parseOBDResponse('41 0C 1A F8', '010C')).toBe(1724);
      
      // Speed (Mode 01, PID 0D): A
      expect(parseOBDResponse('41 0D 32', '010D')).toBe(50);
    });
    
    it('should handle non-numeric responses', () => {
      expect(parseOBDResponse('NO DATA', '010C')).toBeNull();
      expect(parseOBDResponse('ERROR', '010C')).toBeNull();
    });
    
    it('should handle unsupported PIDs', () => {
      expect(parseOBDResponse('41 99 00', '0199')).toBeNull();
    });
  });
});
