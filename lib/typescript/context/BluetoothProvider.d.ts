import React, { type ReactNode, type FC } from 'react';
import BleManager from 'react-native-ble-manager';
import type { DeferredPromise } from '../types';
interface BluetoothProviderProps {
    children: ReactNode;
}
interface CommandExecutionState {
    promise: DeferredPromise<string | Uint8Array>;
    timeoutId: NodeJS.Timeout | null;
    responseBuffer: number[];
    expectedReturnType: 'string' | 'bytes';
}
/**
 * Provides the Bluetooth state and dispatch function to the application.
 * Initializes BleManager and sets up global event listeners.
 */
export declare const BluetoothProvider: FC<BluetoothProviderProps>;
export declare const useInternalCommandControl: () => {
    currentCommandRef: React.MutableRefObject<CommandExecutionState | null>;
};
declare module 'react-native-ble-manager' {
    interface BleManager {
        start: (options?: {
            showAlert?: boolean;
        }) => Promise<void>;
        checkState: () => void;
        enableBluetooth: () => Promise<void>;
        scan: (serviceUUIDs: string[], seconds: number, allowDuplicates: boolean) => Promise<void>;
        stopScan: () => Promise<void>;
        connect: (peripheralId: string) => Promise<void>;
        disconnect: (peripheralId: string) => Promise<void>;
        retrieveServices: (peripheralId: string) => Promise<Peripheral>;
        startNotification: (peripheralId: string, serviceUUID: string, characteristicUUID: string) => Promise<void>;
        stopNotification: (peripheralId: string, serviceUUID: string, characteristicUUID: string) => Promise<void>;
        write: (peripheralId: string, serviceUUID: string, characteristicUUID: string, data: number[]) => Promise<void>;
        writeWithoutResponse: (peripheralId: string, serviceUUID: string, characteristicUUID: string, data: number[]) => Promise<void>;
    }
    const BleManager: BleManager;
}
export default BleManager;
//# sourceMappingURL=BluetoothProvider.d.ts.map