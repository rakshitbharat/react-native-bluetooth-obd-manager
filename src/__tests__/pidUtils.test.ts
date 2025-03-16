import { formatPidCommand, convertPidValue } from '../utils/pidUtils';

describe('pidUtils', () => {
  describe('formatPidCommand', () => {
    it('should format PID command correctly with mode and pid', () => {
      // Test common PIDs
      expect(formatPidCommand(1, 12)).toBe('010C'); // RPM
      expect(formatPidCommand(1, 13)).toBe('010D'); // Speed
      expect(formatPidCommand(1, 5)).toBe('0105'); // Engine coolant temp
      expect(formatPidCommand(1, 0)).toBe('0100'); // Supported PIDs 1-32
    });

    it('should format commands with different modes', () => {
      expect(formatPidCommand(9, 2)).toBe('0902'); // VIN
      expect(formatPidCommand(3, 1)).toBe('0301'); // DTC
      expect(formatPidCommand(4, 0)).toBe('0400'); // Clear DTCs
    });

    it('should handle single digit PIDs', () => {
      expect(formatPidCommand(1, 5)).toBe('0105');
      expect(formatPidCommand(1, 0)).toBe('0100');
    });

    it('should handle larger PIDs', () => {
      expect(formatPidCommand(1, 78)).toBe('014E');
      expect(formatPidCommand(1, 255)).toBe('01FF');
    });
  });

  describe('convertPidValue', () => {
    it('should convert RPM values correctly', () => {
      expect(convertPidValue('410C1AF8', '010C')).toBe(1724); // ((1A*256)+F8)/4 = 1724 RPM
      expect(convertPidValue('410C0BB8', '010C')).toBe(750);  // ((0B*256)+B8)/4 = 750 RPM
      expect(convertPidValue('410C27FF', '010C')).toBe(2559.75); // ((27*256)+FF)/4 = 2559.75 RPM
    });

    it('should convert vehicle speed correctly', () => {
      expect(convertPidValue('410D32', '010D')).toBe(50); // 50 km/h
      expect(convertPidValue('410D78', '010D')).toBe(120); // 120 km/h
      expect(convertPidValue('410D00', '010D')).toBe(0); // 0 km/h
    });

    it('should convert engine coolant temperature correctly', () => {
      expect(convertPidValue('41056E', '0105')).toBe(70); // 110-40 = 70°C
      expect(convertPidValue('410500', '0105')).toBe(-40); // 0-40 = -40°C
      expect(convertPidValue('4105FF', '0105')).toBe(215); // 255-40 = 215°C
    });

    it('should handle null or invalid responses', () => {
      expect(convertPidValue('NO DATA', '010C')).toBeNull();
      expect(convertPidValue('7F0112', '010C')).toBeNull(); // Error response
      expect(convertPidValue('UNABLE TO CONNECT', '010C')).toBeNull();
    });

    it('should handle unsupported PIDs', () => {
      // Testing an unsupported PID command
      expect(convertPidValue('4199FF', '0199')).toBeNull();
    });
  });
});
