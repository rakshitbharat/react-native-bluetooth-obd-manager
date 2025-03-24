import React, {useEffect, useState} from 'react';
import {
  NativeModules,
  NativeEventEmitter,
} from '@own-react-native';
import BLEDataReceiver from '@src/helper/OBDManagerHelper/BLEDataReceiver';
import {BluetoothProvider} from '@src/context/BluetoothContext';
import BleManagerWrapper from '@src/helper/BleManagerWrapper';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const ReduxApp = () => {
  const [isBLEStarted, setIsBLEStarted] = useState(false);

  useEffect(() => {
    let subscription;

    async function initializeBLE() {
      BleManagerWrapper.start();
      setIsBLEStarted(true);

      subscription = bleManagerEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        data => BLEDataReceiver.updateValueFromCharacteristic(data),
      );
    }
    
    initializeBLE();

    return () => {
      subscription?.remove();
    };
  }, []);

  if (!isBLEStarted) {
    return null;
  }

  return (
    <BluetoothProvider>
      {/* Your app content goes here */}
    </BluetoothProvider>
  );
};

export default ReduxApp;
