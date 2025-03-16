import {useState, useEffect, useRef} from 'react';
import {DeviceEventEmitter, Platform} from '@own-react-native';
import BleManager from '@src/helper/BleManagerWrapper';
import {
  BleScanCallbackType,
  BleScanMatchMode,
  BleScanMode,
} from '@src/helper/BleManagerWrapper';
import {log as logMain} from '@src/utils/logs';
import {
  DEFAULT_SERVICE_UUID,
  DEFAULT_SERVICE_UUID_SHORT,
} from '@src/helper/OBDManagerHelper/OBDMonitor';

const log = (...args) => {
  if (typeof args[1] === 'string') {
    args[1] = `[useManageBluetooth] ${args[1]}`;
  }
  logMain(...args);
};

const SCAN_DURATION = 5000; // 5 seconds
const AUTOMIND_DEVICE_FOUND_EVENT = 'AutomindDeviceFound';
const OBD_DEVICE_FOUND_EVENT = 'OBDDeviceFound';

export default useManageBluetooth = () => {
  const [deviceMap, setDeviceMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [isBluetoothConnecting, setIsBluetoothConnecting] = useState(false);
  const autoConnectFlag = useRef(false);
  const connectionInProgress = useRef(false);

  const fetchConnectedDevices = async () => {
    try {
      const connected = await BleManager.getConnectedPeripherals([]);
      return connected.reduce((acc, device) => {
        acc[device.id] = device;
        return acc;
      }, {});
    } catch (error) {
      log('error', 'Error fetching connected devices:', error);
      return {};
    }
  };

  const findOBDCapableDeviceFromDevices = devices => {
    if (!devices || Object.keys(devices).length === 0) return null;

    for (const id in devices) {
      const device = devices[id];
      if (!device.name) continue;

      if (isOBDCompatibleDevice(device.name) || device.is_obd_capable === true) {
        DeviceEventEmitter.emit(OBD_DEVICE_FOUND_EVENT, device);
        return device;
      }
    }
    return null;
  };

  const isOBDCompatibleDevice = deviceName => {
    const obdKeywords = ['obd', 'elm327', 'obdii'];
    return obdKeywords.some(keyword => 
      deviceName.toLowerCase().includes(keyword)
    );
  };

  useEffect(() => {
    let subscription_discover = null;
    let subscription_stop = null;

    if (isBluetoothEnabled) {
      let localDeviceMap = {};
      let liveNearbyDeviceMap = {};

      subscription_discover = DeviceEventEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        device => {
          if (device.id && device.name) {
            localDeviceMap[device.id] = device;
            liveNearbyDeviceMap[device.id] = device;

            // Check if device is OBD compatible
            if (isOBDCompatibleDevice(device.name)) {
              DeviceEventEmitter.emit(OBD_DEVICE_FOUND_EVENT, device);
              BleManager.stopScan();
            }
          }
        },
      );

      subscription_stop = DeviceEventEmitter.addListener(
        'BleManagerStopScan',
        async () => {
          const connectedDeviceMap = await fetchConnectedDevices();
          liveNearbyDeviceMap = {...liveNearbyDeviceMap, ...connectedDeviceMap};
          
          const mergedDeviceMap = {
            ...localDeviceMap,
            ...connectedDeviceMap
          };

          setDeviceMap(mergedDeviceMap);
          
          let obdDevice = findOBDCapableDeviceFromDevices(liveNearbyDeviceMap);
          if (obdDevice) {
            DeviceEventEmitter.emit(OBD_DEVICE_FOUND_EVENT, obdDevice);
          }

          if (autoConnectFlag.current) {
            await handleDeviceTouched(obdDevice);
            autoConnectFlag.current = false;
          }
          setLoading(false);
        },
      );
    }

    return () => {
      subscription_discover?.remove();
      subscription_stop?.remove();
    };
  }, [isBluetoothEnabled]);

  const scanDevices = async (autoConnect = true) => {
    connectionInProgress.current = false;
    autoConnectFlag.current = autoConnect;
    setLoading(true);
    BleManager.scan(
      [DEFAULT_SERVICE_UUID, DEFAULT_SERVICE_UUID_SHORT],
      SCAN_DURATION / 1000,
      true,
      {
        matchMode: BleScanMatchMode.Sticky,
        scanMode: BleScanMode.LowLatency,
        callbackType: BleScanCallbackType.AllMatches,
      },
    );
  };

  const handleDeviceTouched = async device => {
    if (!device?.id || connectionInProgress.current === true) {
      return false;
    }

    setIsBluetoothConnecting(true);
    connectionInProgress.current = true;

    try {
      await BleManager.stopScan();
      await BleManager.stopAll();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await BleManager.connect(device.id);
      
      const isConnected = await BleManager.isPeripheralConnected(device.id);
      connectionInProgress.current = false;
      setIsBluetoothConnecting(false);
      
      return isConnected;
    } catch (error) {
      connectionInProgress.current = false;
      setIsBluetoothConnecting(false);
      log('error', error);
      return false;
    }
  };

  return {
    deviceMap,
    scanDevices,
    handleDeviceTouched,
    loading,
    isBluetoothConnecting,
  };
};
