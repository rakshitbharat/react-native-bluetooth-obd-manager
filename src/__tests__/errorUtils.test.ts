import { 
  BluetoothErrorType, 
  BluetoothOBDError, 
  logBluetoothError 
} from '../utils/errorUtils';

// Mock console.error
const originalConsoleError = console.error;
console.error = jest.fn();

describe('errorUtils', () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  describe('BluetoothErrorType', () => {
    it('should define all error types', () => {
      expect(BluetoothErrorType.INITIALIZATION_ERROR).toBe('INITIALIZATION_ERROR');
      expect(BluetoothErrorType.PERMISSION_ERROR).toBe('PERMISSION_ERROR');
      expect(BluetoothErrorType.CONNECTION_ERROR).toBe('CONNECTION_ERROR');
      expect(BluetoothErrorType.SERVICE_ERROR).toBe('SERVICE_ERROR');
      expect(BluetoothErrorType.CHARACTERISTIC_ERROR).toBe('CHARACTERISTIC_ERROR');
      expect(BluetoothErrorType.NOTIFICATION_ERROR).toBe('NOTIFICATION_ERROR');
      expect(BluetoothErrorType.WRITE_ERROR).toBe('WRITE_ERROR');
      expect(BluetoothErrorType.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
    });
  });

  describe('BluetoothOBDError', () => {
    it('should create an error with the correct properties', () => {
      const details = { deviceId: '12:34:56:78:90' };
      const error = new BluetoothOBDError(
        BluetoothErrorType.CONNECTION_ERROR,
        'Failed to connect',
        details
      );

      expect(error.type).toBe(BluetoothErrorType.CONNECTION_ERROR);
      expect(error.message).toBe('Failed to connect');
      expect(error.name).toBe('BluetoothOBDError');
      expect(error.details).toEqual(details);
      expect(error instanceof Error).toBe(true);
    });

    it('should work without optional details', () => {
      const error = new BluetoothOBDError(
        BluetoothErrorType.TIMEOUT_ERROR,
        'Command timed out'
      );

      expect(error.type).toBe(BluetoothErrorType.TIMEOUT_ERROR);
      expect(error.message).toBe('Command timed out');
      expect(error.details).toBeUndefined();
    });
  });

  describe('logBluetoothError', () => {
    it('should log errors to console', () => {
      const error = new BluetoothOBDError(
        BluetoothErrorType.CONNECTION_ERROR,
        'Connection failed'
      );
      
      logBluetoothError(error);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Bluetooth Error][CONNECTION_ERROR]:', 
        'Connection failed', 
        undefined
      );
    });

    it('should log details when provided', () => {
      const details = { deviceId: 'test-device-id' };
      const error = new BluetoothOBDError(
        BluetoothErrorType.SERVICE_ERROR,
        'Service not found',
        details
      );
      
      logBluetoothError(error);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Bluetooth Error][SERVICE_ERROR]:', 
        'Service not found', 
        details
      );
    });

    it('should handle regular errors', () => {
      const error = new Error('Generic error');
      
      logBluetoothError(error);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Bluetooth Error][UNKNOWN]:', 
        'Generic error', 
        undefined
      );
    });
  });
});
