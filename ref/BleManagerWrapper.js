import {
  NativeEventEmitter,
  NativeModules,
  Platform,
} from '@own-react-native';
import BleManagerMain, {
  BleScanCallbackType,
  BleScanMatchMode,
  BleScanMode,
  BleState,
  BleStatus,
  BleManagerDidUpdateValueForCharacteristicEvent,
  BleManagerDidUpdateStateEvent,
  BleDisconnectPeripheralEvent,
  BleManagerDidUpdateNotificationStateForCharacteristicEvent,
  BleStopScanEvent,
  BleDiscoverPeripheralEvent,
  BleConnectPeripheralEvent,
  BleManagerEmitter,
} from '@src/helper/core_libs/BLE/BleMWrapper';
import {stringToBytes} from 'convert-string';

// add method called BleManagerMain.getInstance(); but if it is already defined, then return the existing instance
if (!BleManagerMain.getInstance) {
  BleManagerMain.getInstance = () => {
    return BleManagerMain;
  };
}

// Export specific types and enums
export {
  BleScanCallbackType,
  BleScanMatchMode,
  BleScanMode,
  BleState,
  BleStatus,
  BleManagerDidUpdateValueForCharacteristicEvent,
  BleManagerDidUpdateStateEvent,
  BleDisconnectPeripheralEvent,
  BleManagerDidUpdateNotificationStateForCharacteristicEvent,
  BleStopScanEvent,
  BleDiscoverPeripheralEvent,
  BleConnectPeripheralEvent,
};

// Set up global BleManager
if (!global.BleManager) {
  global.BleManager = BleManagerMain;
}
const BleManager = global.BleManager;

// timeout can delay connection
const TIMEOUT_DURATION = 50000;

// Add this before creating the emitter
if (!NativeModules.BleManager) {
  throw new Error('BleManager native module not linked');
}

class BleManagerWrapper {
  static instance = null;
  static isCreatingInstance = false;

  constructor() {
    if (!BleManagerWrapper.isCreatingInstance) {
      throw new Error(
        'BleManagerWrapper is a singleton. Use getInstance() instead of new operator.',
      );
    }

    if (BleManagerWrapper.instance) {
      return BleManagerWrapper.instance;
    }

    // Get the BlePlxWrapper instance
    this.BleManager = BleManagerMain.getInstance();
    this.eventEmitter = null;
    this.listeners = [];

    BleManagerWrapper.instance = this;
    return this;
  }

  static getInstance() {
    if (!BleManagerWrapper.instance) {
      BleManagerWrapper.isCreatingInstance = true;
      BleManagerWrapper.instance = new BleManagerWrapper();
      BleManagerWrapper.isCreatingInstance = false;
    }
    return BleManagerWrapper.instance;
  }

  static hasInstance() {
    return BleManagerWrapper.instance !== null;
  }

  async start() {
    try {
      if (global.isBLEManagerInitialized) {
        return true;
      }

      await this.BleManager.start({showAlert: true});
      global.isBLEManagerInitialized = true;
      this.stopAll();

      if (!this.eventEmitter) {
        this.eventEmitter = BleManagerEmitter;
      }
      return true;
    } catch (error) {
      throw error;
    }
  }

  stopAll = () => {
    if (this.BleManager && typeof this.BleManager.stopScan === 'function') {
      this.BleManager.stopScan();
    }
    this.removeAllListeners();
  };

  removeAllListeners() {
    if (this.listeners) {
      for (const listener of this.listeners) {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      }
    }
    this.listeners = [];
  }

  async disconnect(deviceId) {
    return this.BleManager.disconnect(deviceId);
  }

  async connect(deviceId) {
    return this.BleManager.connect(deviceId);
  }

  async isPeripheralConnected(deviceId) {
    return this.BleManager.isPeripheralConnected(deviceId);
  }

  async retrieveServices(deviceId) {
    return this.BleManager.retrieveServices(deviceId);
  }

  async write(deviceId, serviceUUID, characteristicUUID, data) {
    return this.BleManager.write(
      deviceId,
      serviceUUID,
      characteristicUUID,
      data,
    );
  }

  async writeWithoutResponse(deviceId, serviceUUID, characteristicUUID, data) {
    return this.BleManager.writeWithoutResponse(
      deviceId,
      serviceUUID,
      characteristicUUID,
      data,
    );
  }

  async startNotification(deviceId, serviceUUID, characteristicUUID) {
    return this.BleManager.startNotification(
      deviceId,
      serviceUUID,
      characteristicUUID,
    );
  }

  async stopNotification(deviceId, serviceUUID, characteristicUUID) {
    return this.BleManager.stopNotification(
      deviceId,
      serviceUUID,
      characteristicUUID,
    );
  }

  static compareUUIDToStartNotificationforIOS(uuid) {
    if (Platform.OS === 'ios') {
      const baseUUID = /0000(....)-0000-1000-8000-00805F9B34FB/;
      if (baseUUID.test(uuid.toUpperCase())) {
        return uuid.substring(4, 8);
      } else {
        return uuid;
      }
    }
    return uuid;
  }

  async getBondedPeripherals() {
    return this.BleManager.getBondedPeripherals([]);
  }

  delay = ms => new Promise(resolve => setTimeout(resolve, ms));
}

// Create singleton instance using getInstance
const instance = BleManagerWrapper.getInstance();

// Create proxy to handle method forwarding
const handler = {
  get(target, propKey) {
    if (propKey === 'getInstance') {
      return BleManagerWrapper.getInstance;
    }

    const value = target[propKey];
    if (value !== undefined) {
      return typeof value === 'function' ? value.bind(target) : value;
    }

    // If not found in wrapper, check if it exists in BleManager
    const bleManagerValue = target.BleManager[propKey];
    if (bleManagerValue !== undefined) {
      return typeof bleManagerValue === 'function'
        ? bleManagerValue.bind(target.BleManager)
        : bleManagerValue;
    }

    return undefined;
  },
};

// Export proxied singleton
export default new Proxy(instance, handler);

// Add a way to check instance status
export const checkBleManagerInstance = () => {
  return {
    hasInstance: BleManagerWrapper.hasInstance(),
    instance: BleManagerWrapper.instance,
  };
};
