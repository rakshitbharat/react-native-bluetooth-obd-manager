import { 
  requestBluetoothPermissions,
  checkBluetoothPermissions,
  checkBluetoothState
} from '../utils/permissionUtils';
import { Platform } from 'react-native';
import * as Permissions from 'react-native-permissions';
import BleManager from 'react-native-ble-manager';
import type { Permission, PermissionStatus } from 'react-native-permissions';

// Mock dependencies
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 31, // Android 12
  },
}));

// Mock BLE Manager
jest.mock('react-native-ble-manager', () => ({
  checkState: jest.fn(),
}));

describe('permissionUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Platform OS to Android by default
    Platform.OS = 'android';
    Platform.Version = 31;
  });

  describe('checkBluetoothPermissions', () => {
    it('should return true when permissions are granted', async () => {
      // Mock permission check to return granted
      jest.spyOn(Permissions, 'check').mockResolvedValue('granted');
      jest.spyOn(Permissions, 'checkMultiple').mockImplementation(async (permissions: Permission[]) => {
        const result: Record<Permission, PermissionStatus> = {} as Record<Permission, PermissionStatus>;
        permissions.forEach(key => {
          result[key] = 'granted';
        });
        return result;
      });

      const result = await checkBluetoothPermissions();
      expect(result).toBe(true);
    });

    it('should return false when permissions are denied', async () => {
      jest.spyOn(Permissions, 'check').mockResolvedValue('denied');
      jest.spyOn(Permissions, 'checkMultiple').mockImplementation(async (permissions: Permission[]) => {
        const result: Record<Permission, PermissionStatus> = {} as Record<Permission, PermissionStatus>;
        permissions.forEach(key => {
          result[key] = 'denied';
        });
        return result;
      });

      const result = await checkBluetoothPermissions();
      expect(result).toBe(false);
    });
  });

  describe('requestBluetoothPermissions', () => {
    it('should return true when permissions are granted', async () => {
      jest.spyOn(Permissions, 'request').mockResolvedValue('granted');
      jest.spyOn(Permissions, 'requestMultiple').mockImplementation(async (permissions: Permission[]) => {
        const result: Record<Permission, PermissionStatus> = {} as Record<Permission, PermissionStatus>;
        permissions.forEach(key => {
          result[key] = 'granted';
        });
        return result;
      });

      const result = await requestBluetoothPermissions();
      expect(result).toBe(true);
    });

    it('should return false when permissions are denied', async () => {
      jest.spyOn(Permissions, 'request').mockResolvedValue('denied');
      jest.spyOn(Permissions, 'requestMultiple').mockImplementation(async (permissions: Permission[]) => {
        const result: Record<Permission, PermissionStatus> = {} as Record<Permission, PermissionStatus>;
        permissions.forEach(key => {
          result[key] = 'denied';
        });
        return result;
      });

      const result = await requestBluetoothPermissions();
      expect(result).toBe(false);
    });
  });

  describe('checkBluetoothState', () => {
    it('should return true when Bluetooth is on', async () => {
      (BleManager.checkState as jest.Mock).mockResolvedValue('on');
      
      const result = await checkBluetoothState();
      
      expect(BleManager.checkState).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when Bluetooth is off', async () => {
      (BleManager.checkState as jest.Mock).mockResolvedValue('off');
      
      const result = await checkBluetoothState();
      
      expect(BleManager.checkState).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle errors and return false', async () => {
      (BleManager.checkState as jest.Mock).mockRejectedValue(new Error('Test error'));
      
      const result = await checkBluetoothState();
      
      expect(BleManager.checkState).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
