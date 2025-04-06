export interface BleEvent {
  peripheral: string;
  characteristic?: string;
  service?: string;
}

export interface BleManagerDidUpdateValueForCharacteristicEvent extends BleEvent {
  value: number[];
}

export interface BleDisconnectPeripheralEvent extends BleEvent {
  reason?: string;
}

declare module 'react-native-ble-manager' {
  export interface Service {
    uuid: string;
  }

  export interface Characteristic {
    service: string;
    characteristic: string;
    properties: {
      Write?: boolean;
      Read?: boolean;
      Notify?: boolean;
      WriteWithoutResponse?: boolean;
    };
  }

  export interface Peripheral {
    id: string;
    name?: string;
    rssi?: number;
    advertising?: {
      isConnectable?: boolean;
      serviceUUIDs?: string[];
      manufacturerData?: Buffer;
      serviceData?: Record<string, Buffer>;
      txPowerLevel?: number;
    };
    services?: Service[];
    characteristics?: Characteristic[];
  }

  interface BleManager {
    start: (options?: { showAlert?: boolean }) => Promise<void>;
    checkState: () => void;
    enableBluetooth: () => Promise<void>;
    scan: (
      serviceUUIDs: string[],
      seconds: number,
      allowDuplicates: boolean,
    ) => Promise<void>;
    stopScan: () => Promise<void>;
    connect: (peripheralId: string) => Promise<void>;
    disconnect: (peripheralId: string) => Promise<void>;
    retrieveServices: (peripheralId: string) => Promise<Peripheral>;
    startNotification: (
      peripheralId: string,
      serviceUUID: string,
      characteristicUUID: string,
    ) => Promise<void>;
    stopNotification: (
      peripheralId: string,
      serviceUUID: string,
      characteristicUUID: string,
    ) => Promise<void>;
    write: (
      peripheralId: string,
      serviceUUID: string,
      characteristicUUID: string,
      data: number[],
    ) => Promise<void>;
    writeWithoutResponse: (
      peripheralId: string,
      serviceUUID: string,
      characteristicUUID: string,
      data: number[],
    ) => Promise<void>;
  }

  const BleManager: BleManager;
  export default BleManager;
}
