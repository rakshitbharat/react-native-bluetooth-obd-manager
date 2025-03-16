import { decodeData, encodeCommand, isResponseComplete, formatResponse } from '../utils/dataUtils';
import { BluetoothErrorType, BluetoothOBDError } from '../utils/errorUtils';

describe('dataUtils', () => {
  describe('encodeCommand', () => {
    it('should encode command strings to byte arrays', () => {
      const command = 'ATZ\r';
      const result = encodeCommand(command);

      // Expected bytes for 'ATZ\r'
      expect(result).toEqual([65, 84, 90, 13]);
    });
  });

  describe('decodeData', () => {
    it('should decode byte arrays to strings', () => {
      const bytes = [69, 76, 77, 51, 50, 55, 32, 118, 49, 46, 53, 13, 62];
      const result = decodeData(bytes);

      // 'ELM327 v1.5\r>'
      expect(result).toBe('ELM327 v1.5\r>');
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
  });

  describe('formatResponse', () => {
    it('should clean up OBD responses by removing echo and prompt', () => {
      const response = 'ATZ\rELM327 v1.5\r>';
      const command = 'ATZ';
      const result = formatResponse(response, command);

      expect(result).toBe('ELM327 v1.5');
    });
  });
});

describe('errorUtils', () => {
  describe('BluetoothOBDError', () => {
    it('should create an error with the correct type and message', () => {
      const error = new BluetoothOBDError(BluetoothErrorType.CONNECTION_ERROR, 'Failed to connect');

      expect(error.type).toBe(BluetoothErrorType.CONNECTION_ERROR);
      expect(error.message).toBe('Failed to connect');
      expect(error.name).toBe('BluetoothOBDError');
    });

    it('should include optional details', () => {
      const details = { deviceId: '12:34:56:78:90' };
      const error = new BluetoothOBDError(
        BluetoothErrorType.CONNECTION_ERROR,
        'Failed to connect',
        details,
      );

      expect(error.details).toEqual(details);
    });
  });
});
