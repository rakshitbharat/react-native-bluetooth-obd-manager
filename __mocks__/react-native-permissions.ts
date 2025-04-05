import { jest } from '@jest/globals';
import type * as RNP from 'react-native-permissions';

export const RESULTS: typeof RNP.RESULTS = {
  UNAVAILABLE: 'unavailable',
  DENIED: 'denied',
  LIMITED: 'limited',
  GRANTED: 'granted',
  BLOCKED: 'blocked',
};

export const PERMISSIONS: typeof RNP.PERMISSIONS = {
  ANDROID: {
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
    BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
  } as typeof RNP.PERMISSIONS.ANDROID,
  IOS: {
    LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
    BLUETOOTH_PERIPHERAL: 'ios.permission.BLUETOOTH_PERIPHERAL',
  } as typeof RNP.PERMISSIONS.IOS,
};

export const check = jest.fn(async () => Promise.resolve(RESULTS.GRANTED));
export const request = jest.fn(async () => Promise.resolve(RESULTS.GRANTED));

export const checkMultiple = jest.fn(async <P extends RNP.Permission[]>(permissions: P) => {
    const statuses: RNP.PermissionStatusMap = {};
    permissions.forEach(p => statuses[p] = RESULTS.GRANTED);
    return Promise.resolve(statuses);
});

export const requestMultiple = jest.fn(async <P extends RNP.Permission[]>(permissions: P) => {
    const statuses: RNP.PermissionStatusMap = {};
    permissions.forEach(p => statuses[p] = RESULTS.GRANTED);
    return Promise.resolve(statuses);
});

export const openSettings = jest.fn(() => Promise.resolve());

export default {
    PERMISSIONS,
    RESULTS,
    check,
    request,
    checkMultiple,
    requestMultiple,
    openSettings,
};
