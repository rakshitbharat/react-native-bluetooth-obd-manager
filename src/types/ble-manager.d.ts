declare module 'react-native-ble-manager' {
  export type BluetoothState =
    | 'on'
    | 'off'
    | 'turning_on'
    | 'turning_off'
    | 'unknown';

  export interface BleManagerDidUpdateValueForCharacteristicEvent {
    peripheral: string;
    characteristic: string;
    service: string;
    value: number[];
  }
}
