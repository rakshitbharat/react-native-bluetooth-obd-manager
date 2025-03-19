declare module 'react-native' {
  export class NativeEventEmitter {
    constructor(nativeModule: any);
    addListener(eventType: string, listener: (event: any) => void): { remove: () => void };
    removeAllListeners(eventType: string): void;
  }

  export interface NativeModulesStatic {
    BleManager: {
      addListener(eventType: string, listener: (event: any) => void): void;
      removeAllListeners(eventType: string): void;
      isPeripheralConnected(peripheralId: string, serviceUUIDs: string[]): Promise<boolean>;
      writeWithoutResponse(
        peripheralId: string,
        serviceUUID: string,
        characteristicUUID: string,
        data: number[],
      ): Promise<void>;
    };
  }

  export const NativeModules: NativeModulesStatic;
  export const Platform: {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
    Version: number;
    isPad?: boolean;
    isTV?: boolean;
    select<T>(spec: { ios?: T; android?: T; native?: T; default?: T }): T;
  };
}

declare module 'react-native-ble-manager' {
  export interface Service {
    uuid: string;
    isPrimary?: boolean;
  }

  export interface Characteristic {
    uuid: string;
    serviceUUID: string;
    deviceID: string;
    properties: {
      Write?: boolean;
      Read?: boolean;
      WriteWithoutResponse?: boolean;
      Notify?: boolean;
      Indicate?: boolean;
    };
  }

  export interface Peripheral {
    id: string;
    name?: string;
    rssi?: number;
    advertising?: {
      isConnectable?: boolean;
      manufacturerData?: string;
      serviceUUIDs?: string[];
    };
    services?: Service[];
  }

  interface BleManagerModule {
    start(options?: { showAlert?: boolean }): Promise<void>;
    stop(): Promise<void>;
    scan(serviceUUIDs: string[], seconds: number, allowDuplicates?: boolean): Promise<void>;
    stopScan(): Promise<void>;
    connect(peripheralId: string): Promise<void>;
    disconnect(peripheralId: string): Promise<void>;
    retrieveServices(peripheralId: string): Promise<Peripheral>;
    retrieveCharacteristics(peripheralId: string, serviceUUID: string): Promise<Characteristic[]>;
    startNotification(
      peripheralId: string,
      serviceUUID: string,
      characteristicUUID: string,
    ): Promise<void>;
    stopNotification(
      peripheralId: string,
      serviceUUID: string,
      characteristicUUID: string,
    ): Promise<void>;
    write(
      peripheralId: string,
      serviceUUID: string,
      characteristicUUID: string,
      data: number[],
    ): Promise<void>;
    read(peripheralId: string, serviceUUID: string, characteristicUUID: string): Promise<number[]>;
    getBleState(): Promise<string>;
    getPeripheralsWithIdentifiers(identifiers: string[]): Promise<Peripheral[]>;
    getConnectedPeripherals(serviceUUIDs: string[]): Promise<Peripheral[]>;
    getDiscoveredPeripherals(): Promise<Peripheral[]>;
    isPeripheralConnected(peripheralId: string, serviceUUIDs: string[]): Promise<boolean>;
    writeWithoutResponse(
      peripheralId: string,
      serviceUUID: string,
      characteristicUUID: string,
      data: number[],
    ): Promise<void>;
  }

  const BleManager: BleManagerModule;
  export default BleManager;
}

declare module 'text-decoding' {
  export class TextDecoder {
    constructor(encoding?: string);
    decode(buffer: Uint8Array | number[]): string;
  }
}

declare module 'convert-string' {
  export function stringToBytes(str: string): number[];
  export function bytesToString(bytes: number[]): string;
  export default {
    stringToBytes,
    bytesToString,
  };
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    getAllKeys(): Promise<string[]>;
    multiGet(keys: string[]): Promise<Array<[string, string | null]>>;
    multiSet(keyValuePairs: Array<[string, string]>): Promise<void>;
    multiRemove(keys: string[]): Promise<void>;
  };
  export default AsyncStorage;
}
