import type { Dispatch } from 'react';
export interface Peripheral {
    id: string;
    name?: string;
    rssi?: number;
    advertising?: {
        isConnectable?: boolean;
        serviceUUIDs?: string[];
        manufacturerData?: any;
        serviceData?: any;
        txPowerLevel?: number;
    };
}
export type BleManagerState = 'on' | 'off' | 'turning_on' | 'turning_off' | 'unknown' | 'resetting' | 'unsupported' | 'unauthorized';
export interface BleManagerDidUpdateValueForCharacteristicEvent {
    peripheral: string;
    characteristic: string;
    service: string;
    value: number[];
}
export interface BleError {
    errorCode: string;
    message: string;
    attErrorCode?: number;
}
/**
 * Configuration details for the active BLE connection to an ELM327 device.
 * Stored once a compatible service/characteristic set is found.
 */
export interface ActiveDeviceConfig {
    serviceUUID: string;
    writeCharacteristicUUID: string;
    notifyCharacteristicUUID: string;
    writeType: 'Write' | 'WriteWithoutResponse';
}
/**
 * Extends the base Peripheral type to include our predictive flag.
 * TODO: Implement the logic to set isLikelyOBD during scanning.
 */
export interface PeripheralWithPrediction extends Peripheral {
    isLikelyOBD?: boolean;
    prediction?: string;
}
export interface DeferredPromise<T = any> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
}
export interface BleDisconnectPeripheralEvent {
    peripheral: string;
    reason?: string;
}
export interface CommandExecutionState {
    promise: DeferredPromise<string | Uint8Array>;
    timeoutId: NodeJS.Timeout | null;
    responseBuffer: number[];
    expectedReturnType: 'string' | 'bytes';
}
export interface CurrentCommand {
    timeoutId?: NodeJS.Timeout;
    responseBuffer: number[];
    expectedReturnType: 'string' | 'bytes';
}
/**
 * Represents the state managed by the Bluetooth context and reducer.
 */
export interface BluetoothState {
    isBluetoothOn: boolean;
    hasPermissions: boolean;
    isInitializing: boolean;
    error: BleError | Error | null;
    isScanning: boolean;
    discoveredDevices: PeripheralWithPrediction[];
    isConnecting: boolean;
    isDisconnecting: boolean;
    connectedDevice: Peripheral | null;
    activeDeviceConfig: ActiveDeviceConfig | null;
    isAwaitingResponse: boolean;
    isStreaming: boolean;
    lastSuccessfulCommandTimestamp: number | null;
}
/**
 * Actions that can be dispatched to the Bluetooth reducer.
 * Uses a discriminated union based on the 'type' property.
 */
export type BluetoothAction = {
    type: 'SET_INITIALIZING';
    payload: boolean;
} | {
    type: 'SET_BLUETOOTH_STATE';
    payload: boolean;
} | {
    type: 'SET_PERMISSIONS_STATUS';
    payload: boolean;
} | {
    type: 'SET_ERROR';
    payload: BleError | Error | null;
} | {
    type: 'RESET_STATE';
} | {
    type: 'SCAN_START';
} | {
    type: 'SCAN_STOP';
} | {
    type: 'DEVICE_FOUND';
    payload: PeripheralWithPrediction;
} | {
    type: 'CLEAR_DISCOVERED_DEVICES';
} | {
    type: 'CONNECT_START';
} | {
    type: 'CONNECT_SUCCESS';
    payload: {
        device: Peripheral;
        config: ActiveDeviceConfig;
    };
} | {
    type: 'CONNECT_FAILURE';
    payload: BleError | Error;
} | {
    type: 'DEVICE_DISCONNECTED';
} | {
    type: 'DISCONNECT_START';
} | {
    type: 'DISCONNECT_SUCCESS';
} | {
    type: 'DISCONNECT_FAILURE';
    payload: BleError | Error;
} | {
    type: 'SEND_COMMAND_START';
} | {
    type: 'COMMAND_SUCCESS';
    payload?: string | Uint8Array;
} | {
    type: 'COMMAND_FAILURE';
    payload: BleError | Error;
} | {
    type: 'COMMAND_TIMEOUT';
} | {
    type: 'DATA_RECEIVED';
    payload: number[];
} | {
    type: 'SET_STREAMING_STATUS';
    payload: boolean;
} | {
    type: 'UPDATE_LAST_SUCCESS_TIMESTAMP';
} | {
    type: 'STREAMING_INACTIVITY_TIMEOUT';
};
/**
 * Type for the dispatch function provided by the Bluetooth context.
 */
export type BluetoothDispatch = Dispatch<BluetoothAction>;
/**
 * Structure of the state context provided to consumers.
 */
export type BluetoothContextState = BluetoothState;
/**
 * Structure of the object returned by the `useBluetooth` hook.
 */
export interface UseBluetoothResult extends BluetoothContextState {
    checkPermissions: () => Promise<boolean>;
    scanDevices: (scanDuration?: number) => Promise<void>;
    connectToDevice: (deviceId: string) => Promise<Peripheral>;
    disconnect: () => Promise<void>;
    sendCommand: (command: string, options?: {
        timeout?: number;
    }) => Promise<string>;
    requestBluetoothPermissions: () => Promise<boolean>;
    promptEnableBluetooth: () => Promise<void>;
    sendCommandRaw: (command: string, options?: {
        timeout?: number;
    }) => Promise<Uint8Array>;
    setStreaming: (shouldStream: boolean) => void;
}
//# sourceMappingURL=index.d.ts.map