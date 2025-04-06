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
 * Provider component that manages Bluetooth state and event listeners.
 *
 * Initializes BleManager and sets up global event listeners for:
 * - Bluetooth state changes
 * - Device discovery during scanning
 * - Connection/disconnection events
 * - Incoming data notifications
 *
 * Wrap your application with this provider to use the `useBluetooth` hook.
 *
 * @param {BluetoothProviderProps} props Component props
 * @param {ReactNode} props.children Child components that will have access to the Bluetooth context
 */
export declare const BluetoothProvider: FC<BluetoothProviderProps>;
/**
 * Internal hook for accessing the command control context.
 * This is used by the BluetoothProvider to manage command execution state.
 * Not meant for external consumption.
 *
 * @internal
 * @returns Command control context containing the current command reference
 * @throws {Error} If used outside of a BluetoothProvider
 */
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