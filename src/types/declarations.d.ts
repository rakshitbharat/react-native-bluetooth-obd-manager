declare module 'react-native' {
  export class NativeEventEmitter {
    constructor(nativeModule: any);
    addListener(eventType: string, listener: (event: any) => void): { remove: () => void };
    removeAllListeners(eventType: string): void;
  }

  export interface EmitterSubscription {
    remove(): void;
  }

  export interface PermissionsAndroidStatic {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: string;
      ACCESS_COARSE_LOCATION: string;
      BLUETOOTH_SCAN: string;
      BLUETOOTH_CONNECT: string;
    };
    RESULTS: {
      GRANTED: string;
      DENIED: string;
      NEVER_ASK_AGAIN: string;
    };
    check(permission: string): Promise<boolean>;
    request(permission: string): Promise<string>;
    requestMultiple(permissions: string[]): Promise<Record<string, string>>;
  }

  export const PermissionsAndroid: PermissionsAndroidStatic;

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
      getState(): Promise<string>;
      enableBluetooth(): Promise<boolean>;
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

  export const View: React.ComponentType<any>;
  export const Text: React.ComponentType<any>;
  export const TouchableOpacity: React.ComponentType<any>;
  export const StyleSheet: any;
  export const Alert: any;
  export const FlatList: React.ComponentType<any>;
  export const ActivityIndicator: React.ComponentType<any>;
  export const ScrollView: React.ComponentClass<any> & {
    scrollToEnd: (options?: { animated?: boolean }) => void;
  };
  export const TextInput: React.ComponentType<any>;
  export const KeyboardAvoidingView: React.ComponentType<any>;
  export const NativeEventEmitter: any;
}

declare module 'react-native-ble-manager' {
  export interface Service {
    uuid: string;
    isPrimary?: boolean;
  }

  export interface Characteristic {
    uuid: string;
    properties: {
      Broadcast?: boolean;
      Read?: boolean;
      WriteWithoutResponse?: boolean;
      Write?: boolean;
      Notify?: boolean;
      Indicate?: boolean;
      AuthenticatedSignedWrites?: boolean;
      ExtendedProperties?: boolean;
      NotifyEncryptionRequired?: boolean;
      IndicateEncryptionRequired?: boolean;
    };
    descriptors?: Descriptor[];
  }

  export interface Peripheral {
    id: string;
    name?: string;
    rssi?: number;
    advertising: {
      isConnectable?: boolean;
      manufacturerData?: string;
      serviceData?: Record<string, string>;
      serviceUUIDs?: string[];
      txPowerLevel?: number;
      localName?: string;
    };
    characteristics?: Characteristic[];
    services?: Service[];
  }

  export interface Descriptor {
    uuid: string;
  }

  interface BleManagerModule {
    start(options?: any): Promise<void>;
    scan(serviceUUIDs: string[], seconds: number, allowDuplicates?: boolean): Promise<void>;
    stopScan(): Promise<void>;
    connect(peripheralId: string): Promise<void>;
    disconnect(peripheralId: string): Promise<void>;
    retrieveServices(peripheralId: string): Promise<Peripheral>;
    retrieveCharacteristics(peripheralId: string, serviceUUID: string): Promise<Characteristic[]>;
    write(
      peripheralId: string,
      serviceUUID: string,
      characteristicUUID: string,
      data: number[],
    ): Promise<void>;
    writeWithoutResponse(
      peripheralId: string,
      serviceUUID: string,
      characteristicUUID: string,
      data: number[],
    ): Promise<void>;
    read(peripheralId: string, serviceUUID: string, characteristicUUID: string): Promise<number[]>;
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
    getBleState(): Promise<string>;
    getPeripheralsWithIdentifiers(identifiers: string[]): Promise<Peripheral[]>;
    getConnectedPeripherals(serviceUUIDs: string[]): Promise<Peripheral[]>;
    getDiscoveredPeripherals(): Promise<Peripheral[]>;
    isPeripheralConnected(peripheralId: string, serviceUUIDs: string[]): Promise<boolean>;
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
