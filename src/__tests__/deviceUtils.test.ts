import { it, describe, expect } from '@jest/globals';
import type { Peripheral, PeripheralInfo } from 'react-native-ble-manager';

import { ConnectionDetails } from '../types/bluetoothTypes';
import { findServiceAndCharacteristic, isOBDDevice, getDeviceName } from '../utils/deviceUtils';

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

// Mock BleManager
jest.mock('react-native-ble-manager', () => ({
  retrieveServices: jest.fn(),
}));

interface MockPeripheralInfo extends Partial<PeripheralInfo> {
  services?: Array<{ uuid: string; isPrimary?: boolean }>;
  characteristics?: Array<{
    service: string;
    characteristic: string;
    properties: Record<string, string>;
  }>;
}

describe('deviceUtils', () => {
  // Test device data with proper types
  const mockDevice: Peripheral = {
    id: 'test-device',
    name: 'OBD Scanner',
    advertising: {},
    rssi: -60,
    connected: false
  };

  const mockPeripheralInfo: MockPeripheralInfo = {
    id: 'test-device',
    services: [
      { uuid: 'FFE0', isPrimary: true }
    ],
    characteristics: [
      {
        service: 'FFE0',
        characteristic: 'FFE1',
        properties: {
          Write: 'Write',
          Notify: 'Notify'
        }
      }
    ]
  };

  describe('findServiceAndCharacteristic', () => {
    it('should find compatible service and characteristics', async () => {
      const expectedDetails: ConnectionDetails = {
        serviceUUID: 'FFE0',
        writeCharacteristicUUID: 'FFE1',
        notifyCharacteristicUUID: 'FFE1',
        writeWithResponse: true
      };

      const result = await findServiceAndCharacteristic(mockPeripheralInfo as PeripheralInfo);
      expect(result).toEqual(expectedDetails);
    });

    it('should find service and characteristics for standard OBD device', async () => {
      const device: MockPeripheralInfo = {
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

      const result = await findServiceAndCharacteristic(device as PeripheralInfo);
      expect(result).toEqual({
        serviceUUID: 'FFE0',
        writeCharacteristicUUID: 'FFE1',
        notifyCharacteristicUUID: 'FFE1',
        writeWithResponse: true
      });
    });

    it('should find separate write and notify characteristics', async () => {
      const device: MockPeripheralInfo = {
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

      const result = await findServiceAndCharacteristic(device as PeripheralInfo);
      expect(result).toEqual({
        serviceUUID: 'FFE0',
        writeCharacteristicUUID: 'FFE2',
        notifyCharacteristicUUID: 'FFE1',
        writeWithResponse: true
      });
    });

    it('should prefer WriteWithoutResponse when available', async () => {
      const device: MockPeripheralInfo = {
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

      const result = await findServiceAndCharacteristic(device as PeripheralInfo);
      expect(result).toEqual({
        serviceUUID: 'FFE0',
        writeCharacteristicUUID: 'FFE1',
        notifyCharacteristicUUID: 'FFE1',
        writeWithResponse: false
      });
    });

    it('should return null when no suitable service found', async () => {
      const device: MockPeripheralInfo = {
        services: [
          { uuid: '1234' } // Not an OBD service
        ],
        characteristics: []
      };

      const result = await findServiceAndCharacteristic(device as PeripheralInfo);
      expect(result).toBeNull();
    });

    it('should return null when no notify characteristic found', async () => {
      const device: MockPeripheralInfo = {
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

      const result = await findServiceAndCharacteristic(device as PeripheralInfo);
      expect(result).toBeNull();
    });
  });

  // Mock the isOBDDevice function for testing
  describe('isOBDDevice', () => {
    it('should identify OBD devices based on name', () => {
      expect(isOBDDevice({ name: 'OBDII' } as Peripheral)).toBe(true);
      expect(isOBDDevice({ name: 'ELM327' } as Peripheral)).toBe(true);
      expect(isOBDDevice({ name: 'OBD-II Adapter' } as Peripheral)).toBe(true);
      expect(isOBDDevice({ name: 'Bluetooth OBD' } as Peripheral)).toBe(true);
    });

    it('should handle case insensitively', () => {
      expect(isOBDDevice({ name: 'obdii' } as Peripheral)).toBe(true);
      expect(isOBDDevice({ name: 'elm327' } as Peripheral)).toBe(true);
    });

    it('should return false for non-OBD devices', () => {
      expect(isOBDDevice({ name: 'Headphones' } as Peripheral)).toBe(false);
      expect(isOBDDevice({ name: 'Bluetooth Speaker' } as Peripheral)).toBe(false);
    });

    it('should handle undefined and null', () => {
      expect(isOBDDevice({ name: undefined } as Peripheral)).toBe(false);
      expect(isOBDDevice({} as Peripheral)).toBe(false);
      expect(isOBDDevice(null as unknown as Peripheral)).toBe(false);
    });

    it('should identify OBD devices by name', () => {
      expect(isOBDDevice(mockDevice as Peripheral)).toBe(true);
    });
  });

  describe('getDeviceName', () => {
    it('should return device name', () => {
      expect(getDeviceName({ name: 'OBDII', id: '123' } as Peripheral)).toBe('OBDII');
      expect(getDeviceName({ name: 'ELM327' } as Peripheral)).toBe('ELM327');
    });

    it('should handle devices with id but no name', () => {
      expect(getDeviceName({ id: '12:34:56:78:90', name: undefined } as Peripheral)).toBe('Device (12:34:56:78:90)');
      expect(getDeviceName({ id: 'ABC123', name: '' } as Peripheral)).toBe('Device (ABC123)');
    });

    it('should handle undefined or invalid input', () => {
      expect(getDeviceName({} as Peripheral)).toBe('Unknown Device');
      expect(getDeviceName(null as unknown as Peripheral)).toBe('Unknown Device');
    });
  });
});
