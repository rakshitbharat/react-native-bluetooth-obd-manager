import { 
  findServiceAndCharacteristic,
  isOBDDevice,
  getDeviceName
} from '../utils/deviceUtils';

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

describe('deviceUtils', () => {
  describe('findServiceAndCharacteristic', () => {
    it('should find service and characteristics for standard OBD device', async () => {
      const device = {
        services: [
          { uuid: 'FFE0' }
        ],
        characteristics: [
          {
            service: 'FFE0',
            characteristic: 'FFE1',
            properties: { Write: 'Write', Notify: 'Notify' }
          }
        ]
      };

      const result = await findServiceAndCharacteristic(device as any);
      expect(result).toEqual({
        serviceUUID: 'FFE0',
        writeCharacteristicUUID: 'FFE1',
        notifyCharacteristicUUID: 'FFE1',
        writeWithResponse: true
      });
    });

    it('should find separate write and notify characteristics', async () => {
      const device = {
        services: [
          { uuid: 'FFE0' }
        ],
        characteristics: [
          {
            service: 'FFE0',
            characteristic: 'FFE1',
            properties: { Notify: 'Notify' }
          },
          {
            service: 'FFE0',
            characteristic: 'FFE2',
            properties: { Write: 'Write' }
          }
        ]
      };

      const result = await findServiceAndCharacteristic(device as any);
      expect(result).toEqual({
        serviceUUID: 'FFE0',
        writeCharacteristicUUID: 'FFE2',
        notifyCharacteristicUUID: 'FFE1',
        writeWithResponse: true
      });
    });

    it('should prefer WriteWithoutResponse when available', async () => {
      const device = {
        services: [
          { uuid: 'FFE0' }
        ],
        characteristics: [
          {
            service: 'FFE0',
            characteristic: 'FFE1',
            properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' }
          }
        ]
      };

      const result = await findServiceAndCharacteristic(device as any);
      expect(result).toEqual({
        serviceUUID: 'FFE0',
        writeCharacteristicUUID: 'FFE1',
        notifyCharacteristicUUID: 'FFE1',
        writeWithResponse: false
      });
    });

    it('should return null when no suitable service found', async () => {
      const device = {
        services: [
          { uuid: '1234' } // Not an OBD service
        ],
        characteristics: []
      };

      const result = await findServiceAndCharacteristic(device as any);
      expect(result).toBeNull();
    });

    it('should return null when no notify characteristic found', async () => {
      const device = {
        services: [
          { uuid: 'FFE0' }
        ],
        characteristics: [
          {
            service: 'FFE0',
            characteristic: 'FFE1',
            properties: { Write: 'Write' } // No Notify property
          }
        ]
      };

      const result = await findServiceAndCharacteristic(device as any);
      expect(result).toBeNull();
    });
  });

  // Mock the isOBDDevice function for testing
  describe('isOBDDevice', () => {
    it('should identify OBD devices based on name', () => {
      expect(isOBDDevice({ name: 'OBDII' })).toBe(true);
      expect(isOBDDevice({ name: 'ELM327' })).toBe(true);
      expect(isOBDDevice({ name: 'OBD-II Adapter' })).toBe(true);
      expect(isOBDDevice({ name: 'Bluetooth OBD' })).toBe(true);
    });

    it('should handle case insensitively', () => {
      expect(isOBDDevice({ name: 'obdii' })).toBe(true);
      expect(isOBDDevice({ name: 'elm327' })).toBe(true);
    });

    it('should return false for non-OBD devices', () => {
      expect(isOBDDevice({ name: 'Headphones' })).toBe(false);
      expect(isOBDDevice({ name: 'Bluetooth Speaker' })).toBe(false);
    });

    it('should handle undefined and null', () => {
      expect(isOBDDevice({ name: undefined })).toBe(false);
      expect(isOBDDevice({ name: null })).toBe(false);
      expect(isOBDDevice({})).toBe(false);
      expect(isOBDDevice(null as any)).toBe(false);
    });
  });

  describe('getDeviceName', () => {
    it('should return device name', () => {
      expect(getDeviceName({ name: 'OBDII' })).toBe('OBDII');
      expect(getDeviceName({ name: 'ELM327' })).toBe('ELM327');
    });

    it('should handle devices with id but no name', () => {
      expect(getDeviceName({ id: '12:34:56:78:90', name: undefined })).toBe('Device (12:34:56:78:90)');
      expect(getDeviceName({ id: 'ABC123', name: '' })).toBe('Device (ABC123)');
    });

    it('should handle undefined or invalid input', () => {
      expect(getDeviceName({} as any)).toBe('Unknown Device');
      expect(getDeviceName(undefined as any)).toBe('Unknown Device');
      expect(getDeviceName(null as any)).toBe('Unknown Device');
    });
  });
});
