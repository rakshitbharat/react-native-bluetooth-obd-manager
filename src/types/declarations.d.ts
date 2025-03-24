declare module 'react-native' {
  export class NativeEventEmitter {
    constructor(nativeModule: NativeModulesStatic);
    addListener(eventType: string, listener: (event: unknown) => void): { remove: () => void };
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

  export interface NativeModulesStatic extends BleManagerType {
    BleManager: {
      addListener(eventType: string, listener: (event: unknown) => void): void;
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
      retrieveServices(peripheralId: string): Promise<Peripheral>;
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

  export const View: React.ComponentType<ViewProps>;
  export const Text: React.ComponentType<TextProps>;
  export const TouchableOpacity: React.ComponentType<TouchableOpacityProps>;
  export const StyleSheet: StyleSheetStatic;
  export const Alert: AlertStatic;
  export const FlatList: React.ComponentType<FlatListProps<unknown>>;
  export const ActivityIndicator: React.ComponentType<ActivityIndicatorProps>;
  export const ScrollView: React.ComponentClass<ScrollViewProps> & {
    scrollToEnd: (options?: { animated?: boolean }) => void;
  };
  export const TextInput: React.ComponentType<TextInputProps>;
  export const KeyboardAvoidingView: React.ComponentType<KeyboardAvoidingViewProps>;
}

declare module 'react-native-ble-manager' {
  export interface Characteristic {
    uuid: string;
    serviceUUID: string;
    properties: {
      Write: boolean;
      WriteWithoutResponse: boolean;
      Read: boolean;
      Notify: boolean;
      Indicate: boolean;
      Broadcast: boolean;
      AuthenticatedSignedWrites: boolean;
      ExtendedProperties: boolean;
      NotifyEncryptionRequired: boolean;
      IndicateEncryptionRequired: boolean;
    };
  }

  export interface Service {
    uuid: string;
    isPrimary: boolean;
  }

  export interface Peripheral {
    id: string;
    name: string;
    services: Service[];
    characteristics: Characteristic[];
  }

  export interface Descriptor {
    uuid: string;
  }

  interface BleManagerModule {
    start(options?: Record<string, unknown>): Promise<void>;
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

export interface ScrollViewMethod {
  scrollToEnd: (params?: { animated?: boolean }) => void;
}

export type ScrollViewRef = React.RefObject<ScrollViewMethod>;

// Add re-exported React Native components that need typing
export const FlatList: React.ComponentClass<FlatListProps<unknown>>;
export const ScrollView: React.ComponentClass<ScrollViewProps> & ScrollViewMethod;

interface BleManagerType {
  BleManager: {
    addListener(eventType: string, listener: (event: BleEventMap[keyof BleEventMap]) => void): void;
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
    retrieveServices(peripheralId: string): Promise<Peripheral>;
  };
}

// Define event map
interface BleEventMap {
  BleManagerDidUpdateState: { state: string };
  BleManagerConnectPeripheral: { peripheral: string };
  BleManagerDisconnectPeripheral: { peripheral: string };
  BleManagerDidUpdateValueForCharacteristic: { value: number[]; peripheral: string };
}
