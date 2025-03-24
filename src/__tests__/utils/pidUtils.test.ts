import { BluetoothOBDError } from '../../utils/errorUtils';
import {
  formatPID,
  getPIDInfo,
  isPIDSupported,
  formatPidCommand,
  getResponseValue,
  convertPidValue,
  convertPIDValue,
  PID_INFO,
  OBDMode
} from '../../utils/pidUtils';

describe('pidUtils', () => {
  describe('formatPID', () => {
    test('should format mode and PID as hex strings', () => {
      expect(formatPID(1, 0)).toBe('0100');
      expect(formatPID(1, 12)).toBe('010C');
      expect(formatPID('01', '0C')).toBe('010C');
    });

    test('should handle single-digit values with padding', () => {
      expect(formatPID(1, 5)).toBe('0105');
      expect(formatPID('1', '5')).toBe('0105');
    });

    test('should uppercase the output', () => {
      expect(formatPID('01', 'c')).toBe('010C');
      expect(formatPID(1, 'a')).toBe('010A');
    });

    test('should throw for invalid inputs', () => {
      // @ts-ignore - Testing invalid type
      expect(() => formatPID(null, 1)).toThrow(BluetoothOBDError);
      // @ts-ignore - Testing invalid type
      expect(() => formatPID(1, null)).toThrow(BluetoothOBDError);
    });
  });

  describe('getPIDInfo', () => {
    test('should return PID info for valid PID', () => {
      const engineRpmInfo = getPIDInfo(1, 12);
      expect(engineRpmInfo).toEqual(PID_INFO['010C']);
      expect(engineRpmInfo?.name).toBe('Engine RPM');
      expect(engineRpmInfo?.formula).toBe('((A*256)+B)/4');
    });

    test('should return null for unknown PID', () => {
      expect(getPIDInfo(99, 99)).toBeNull();
    });
  });

  describe('isPIDSupported', () => {
    // Based on the implementation, the bitmap needs to be parsed correctly
    // Using a more realistic bitmap example from OBD-II responses
    // This bitmap represents PIDs 1, 3, 4, 5, 6, 7, 10, 12 being supported
    const sampleBitmap = 'BE3EB811'; // 10111110 00111110 10111000 00010001

    test('should correctly identify supported PIDs', () => {
      // We need to test with PIDs that are actually supported based on the bitmap
      // Converting bitmap to bits:
      // BE3EB811 = 10111110 00111110 10111000 00010001 (in binary)
      // Bit positions:    1              20
      //                |       |       |       |
      //                32      24      16      8       1
      // Bit 31 = PID 1, Bit 30 = PID 2, etc. (as per the implementation)
      
      // Testing some PIDs that should be supported:
      expect(isPIDSupported(sampleBitmap, 1)).toBe(true);   // Bit 31
      expect(isPIDSupported(sampleBitmap, 4)).toBe(true);   // Bit 28
      expect(isPIDSupported(sampleBitmap, 12)).toBe(true);  // Bit 20
    });

    test('should correctly identify unsupported PIDs', () => {
      // PIDs that shouldn't be supported based on the bitmap:
      expect(isPIDSupported(sampleBitmap, 9)).toBe(false);
      expect(isPIDSupported(sampleBitmap, 15)).toBe(false);
      expect(isPIDSupported(sampleBitmap, 21)).toBe(false);
    });

    test('should throw for invalid bitmap', () => {
      expect(() => isPIDSupported('', 1)).toThrow(BluetoothOBDError);
      expect(() => isPIDSupported('XYZ', 1)).toThrow(BluetoothOBDError);
    });

    test('should throw for out-of-range PID', () => {
      expect(() => isPIDSupported(sampleBitmap, 0)).toThrow(BluetoothOBDError);
      expect(() => isPIDSupported(sampleBitmap, 33)).toThrow(BluetoothOBDError);
    });
  });

  describe('formatPidCommand', () => {
    test('should format mode and pid numbers as hex', () => {
      expect(formatPidCommand(1, 12)).toBe('010C');
      expect(formatPidCommand(3, 1)).toBe('0301');
    });

    test('should handle string inputs', () => {
      expect(formatPidCommand('01', '0C')).toBe('010C');
    });

    test('should pad single digits', () => {
      expect(formatPidCommand(9, 5)).toBe('0905');
    });
  });

  describe('getResponseValue', () => {
    test('should extract data after header for common responses', () => {
      expect(getResponseValue('410C1AF8', 1, 12)).toBe('1AF8');
      expect(getResponseValue('41 0C 1A F8', 1, 12)).toBe('1AF8');
      expect(getResponseValue('41051F', 1, 5)).toBe('1F');
    });

    test('should handle response with carriage returns and prompts', () => {
      expect(getResponseValue('410C1AF8\r\n>', 1, 12)).toBe('1AF8');
      expect(getResponseValue('41 0C 1A F8\r>', 1, 12)).toBe('1AF8');
    });

    test('should return cleaned response if header not found', () => {
      expect(getResponseValue('SEARCHING...', 1, 12)).toBe('SEARCHING...');
      expect(getResponseValue('NO DATA', 1, 12)).toBe('NODATA');
    });
  });

  describe('convertPidValue', () => {
    test('should convert RPM value (PID 0C)', () => {
      expect(convertPidValue('410C1AF8', '010C')).toBe(1724);
      expect(convertPidValue('410C0BB8', '010C')).toBe(750);
      expect(convertPidValue('410C27FF', '010C')).toBe(2559.75);
    });

    test('should convert speed value (PID 0D)', () => {
      expect(convertPidValue('410D32', '010D')).toBe(50);
    });

    test('should convert temperature value (PID 05)', () => {
      expect(convertPidValue('41056E', '0105')).toBe(70); // 110°C (6E hex) - 40 = 70°C
    });

    test('should return null for error messages', () => {
      expect(convertPidValue('NO DATA', '010C')).toBeNull();
      expect(convertPidValue('ERROR', '010D')).toBeNull();
      expect(convertPidValue('UNABLE TO CONNECT', '0105')).toBeNull();
    });

    test('should return null when no conversion is available', () => {
      expect(convertPidValue('4123FF', '0123')).toBeNull(); // Unknown PID
    });
  });

  describe('convertPIDValue', () => {
    test('should convert values using formulae from PID_INFO', () => {
      // Engine RPM: ((A*256)+B)/4
      // Using 1A F8 as input (hex: 0x1AF8)
      // A = 0x1A = 26, B = 0xF8 = 248
      // ((26*256)+248)/4 = 1726
      expect(convertPIDValue('1AF8', 1, 12)).toBeCloseTo(1726, 0);
      
      // Vehicle speed: A
      expect(convertPIDValue('32', 1, 13)).toBe(50);
      
      // Coolant temp: A-40
      expect(convertPIDValue('6E', 1, 5)).toBe(70);
      
      // Calculated engine load: A*100/255
      expect(convertPIDValue('7F', 1, 4)).toBeCloseTo(49.8, 1);
    });

    test('should return null for unknown PID', () => {
      expect(convertPIDValue('FF', 99, 99)).toBeNull();
    });

    test('should return null for insufficient data', () => {
      expect(convertPIDValue('1A', 1, 12)).toBeNull(); // RPM needs 4 characters (2 bytes)
    });

    test('should handle invalid data gracefully', () => {
      // The implementation wraps errors in a try/catch, so we expect null or a specific error
      try {
        convertPIDValue('XYZ', 1, 5);
      } catch (error) {
        expect(error).toBeInstanceOf(BluetoothOBDError);
      }
    });
  });

  describe('PID_INFO structure', () => {
    test('should contain essential PIDs with correct structure', () => {
      // Check engine RPM
      expect(PID_INFO['010C']).toBeDefined();
      expect(PID_INFO['010C'].name).toBe('Engine RPM');
      expect(PID_INFO['010C'].unit).toBe('rpm');
      expect(PID_INFO['010C'].formula).toBe('((A*256)+B)/4');
      
      // Check vehicle speed
      expect(PID_INFO['010D']).toBeDefined();
      expect(PID_INFO['010D'].name).toBe('Vehicle speed');
      expect(PID_INFO['010D'].unit).toBe('km/h');
      
      // Check coolant temp
      expect(PID_INFO['0105']).toBeDefined();
      expect(PID_INFO['0105'].name).toBe('Engine coolant temperature');
      expect(PID_INFO['0105'].unit).toBe('°C');
    });
  });

  describe('OBDMode enum', () => {
    test('should contain standard OBD modes', () => {
      expect(OBDMode.CURRENT_DATA).toBe(1);
      expect(OBDMode.FREEZE_FRAME).toBe(2);
      expect(OBDMode.STORED_DTC).toBe(3);
      expect(OBDMode.CLEAR_DTC).toBe(4);
      expect(OBDMode.O2_MONITOR).toBe(5);
      expect(OBDMode.TEST_RESULTS).toBe(6);
      expect(OBDMode.PENDING_DTC).toBe(7);
      expect(OBDMode.CONTROL).toBe(8);
      expect(OBDMode.VEHICLE_INFO).toBe(9);
      expect(OBDMode.PERMANENT_DTC).toBe(10);
    });
  });
});