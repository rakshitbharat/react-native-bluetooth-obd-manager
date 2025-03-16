import BleManager from './BleManagerWrapper';
import {NativeEventEmitter, NativeModules} from '@own-react-native';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const BluetoothStateManagerWrapper = {
  getState: async () => {
    try {
      const state = await BleManager.checkState();
      return state === 'on' ? 'PoweredOn' : 'PoweredOff';
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      return 'PoweredOff';
    }
  },
  
  onStateChange: (callback, immediate = true) => {
    const subscription = bleManagerEmitter.addListener(
      'BleManagerDidUpdateState',
      ({state}) => {
        callback(state === 'on' ? 'PoweredOn' : 'PoweredOff');
      },
    );

    if (immediate) {
      BleManager.checkState()
        .then(state => {
          callback(state === 'on' ? 'PoweredOn' : 'PoweredOff');
        })
        .catch(error => {
          console.error('Error in immediate state check:', error);
          callback('PoweredOff');
        });
    }

    return {
      remove: () => {
        try {
          subscription.remove();
        } catch (error) {
          console.error('Error removing state change listener:', error);
        }
      },
    };
  }
};

export default BluetoothStateManagerWrapper;
