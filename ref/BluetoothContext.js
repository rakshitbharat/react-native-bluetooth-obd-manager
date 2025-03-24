import React, {createContext, useContext, useEffect} from 'react';
import {NativeEventEmitter, NativeModules} from '@own-react-native';
import BleManager from '@src/helper/BleManagerWrapper';

const BluetoothContext = createContext();

export const useBluetoothContext = () => {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error(
      'useBluetoothContext must be used within a BluetoothProvider',
    );
  }
  return context;
};

export const BluetoothProvider = ({children}) => {
  const [connectedDevice, setConnectedDevice] = React.useState(null);
  const [disconnectedDevice, setDisconnectedDevice] = React.useState(null);

  useEffect(() => {
    const BleManagerModule = NativeModules.BleManager;
    const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

    const connectSubscription = bleManagerEmitter.addListener(
      'BleManagerConnectPeripheral',
      peripheral => {
        console.log('Device connected:', peripheral);
        setConnectedDevice(peripheral);
        setDisconnectedDevice(null);
      },
    );

    const disconnectSubscription = bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      peripheral => {
        console.log('Device disconnected:', peripheral);
        setDisconnectedDevice(peripheral);
        setConnectedDevice(null);
      },
    );

    // Check initial connection status
    BleManager.getConnectedPeripherals([]).then(peripherals => {
      if (peripherals.length > 0) {
        setConnectedDevice(peripherals[0]);
        setDisconnectedDevice(null);
      }
    });

    return () => {
      connectSubscription.remove();
      disconnectSubscription.remove();
    };
  }, []);

  const contextValue = {
    connectedDevice,
    disconnectedDevice,
  };

  return (
    <BluetoothContext.Provider value={contextValue}>
      {children}
    </BluetoothContext.Provider>
  );
};

export default BluetoothContext;
