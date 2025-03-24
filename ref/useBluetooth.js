import {useEffect, useContext, useRef, useMemo} from 'react';
import useSessionStorage from './useSessionStorage';
import BleManager from '@src/helper/BleManagerWrapper';
import {
  PERMISSIONS,
  requestMultiple,
  checkMultiple,
  RESULTS,
} from 'react-native-permissions';
import useDebounce from './useDebounce';
import SystemSetting from '@src/helper/SystemSettingWrapper';
import Alert from '@src/helper/AlertWrapper';
import useStorageState from './useStorageState';
import {Platform} from '@own-react-native';
import BluetoothStateManager from '@src/helper/BluetoothStateManagerWrapper';
import {Linking} from '@own-react-native';
import {log as logMain} from '@src/utils/logs';

const log = (...args) => {
  if (typeof args[1] === 'string') {
    args[1] = `[useBluetooth] ${args[1]}`;
  }
  logMain(...args);
};

const useBluetooth = () => {
  const iosBluetoothSubscriptionListner = useRef(null);
  const {removeItem} = useSessionStorage();

  const {ACCESS_FINE_LOCATION, BLUETOOTH_CONNECT, BLUETOOTH_SCAN} =
    PERMISSIONS.ANDROID;

  const getPermissionStatuses = async checkerFunction => {
    const permissions = Platform.select({
      ios: [PERMISSIONS.IOS.LOCATION_WHEN_IN_USE],
      android: [
        ACCESS_FINE_LOCATION,
        BLUETOOTH_CONNECT,
        PERMISSIONS.ACCESS_COARSE_LOCATION,
        BLUETOOTH_SCAN,
      ],
    });

    return await checkerFunction(permissions);
  };

  const evaluatePermissions = statuses => {
    if (Platform.OS === 'ios') {
      return statuses[PERMISSIONS.IOS.LOCATION_WHEN_IN_USE] === RESULTS.GRANTED;
    } else {
      return (
        statuses[BLUETOOTH_SCAN] === RESULTS.GRANTED &&
        statuses[BLUETOOTH_CONNECT] === RESULTS.GRANTED &&
        statuses[ACCESS_FINE_LOCATION] === RESULTS.GRANTED
      );
    }
  };

  const [isBluetoothEnabled, setBluetoothEnabled] = useStorageState(
    'BluetoothEnabled',
    false,
  );
  const [isPermissionGiven, setPermissionGiven] = useStorageState(
    'PermissionGiven',
    false,
  );
  const [isBluetoothPermissionGiven, setBluetoothPermissionGiven] =
    useStorageState('BluetoothPermissionGiven', true);

  const iSiPadOS = Platform?.constants?.systemName === 'iPadOS';

  const checkBluetoothPermissions = async () => {
    const statuses = await getPermissionStatuses(checkMultiple);
    const hasPermission = evaluatePermissions(statuses);
    setBluetoothPermissionGiven(iSiPadOS ? true : hasPermission);
    return hasPermission;
  };

  const checkBluetoothStatus = async () => {
    if (Platform.OS === 'ios') {
      try {
        const state = await BluetoothStateManager.getState();
        return state === 'PoweredOn';
      } catch (error) {
        log('error', 'Error checking Bluetooth status on iOS: ', error);
        return false;
      }
    } else {
      return await SystemSetting.isBluetoothEnabled();
    }
  };

  const requestBluetoothPermissions = async () => {
    const statuses = await getPermissionStatuses(requestMultiple);
    const hasPermission = evaluatePermissions(statuses);
    return hasPermission;
  };

  useDebounce(
    () => {
      try {
        if (Platform.OS === 'ios') {
          iosBluetoothSubscriptionListner.current =
            BluetoothStateManager.onStateChange(state => {
              const enabled = state === 'PoweredOn';
              checkPermissions(false);
              setBluetoothEnabled(enabled);
            }, true);
        }
        if (Platform.OS !== 'ios') {
          SystemSetting.isBluetoothEnabled().then(enabled => {
            checkPermissions(false);
            setBluetoothEnabled(enabled);
          });

          SystemSetting.addBluetoothListener(enabled => {
            checkPermissions(false);
            setBluetoothEnabled(enabled);
          });
        }
      } catch (e) {}
    },
    300,
    [],
  );

  useEffect(() => {
    if (Platform.OS === 'ios' && iosBluetoothSubscriptionListner?.current) {
      return () => iosBluetoothSubscriptionListner.current.remove();
    }
  }, []);

  const checkBluetooth = async () => {
    let r = await checkBluetoothStatus();
    setBluetoothEnabled(r);
    return r;
  };

  const checkPermissions = async (forceRequestPermissions = true) => {
    let r = true;
    if (!(await checkBluetoothPermissions())) {
      if (forceRequestPermissions) {
        if (!(await requestBluetoothPermissions())) {
          r = false;
        }
      } else {
        r = false;
      }
    }
    setPermissionGiven(r);
    return r;
  };

  const enableBluetoothRequest = async (
    navigation = {navigate: () => {}},
    currentScreenName = screenNameOfBluetoothSwitch,
  ) => {
    try {
      if (!isBluetoothEnabled) {
        if (screenNameOfBluetoothSwitch !== currentScreenName) {
          requestBluetoothEnabling()
            .then(() => {})
            .catch(error => {
              if (screenNameOfBluetoothSwitch !== currentScreenName) {
                resetNavigate(navigation, screenNameOfBluetoothSwitch);
              }
            });
        }
      }
    } catch (e) {}
  };

  const requestBluetoothEnabling = () => {
    return BleManagerEnabler();
  };

  const allPermissionsAndBluetoothEnabled = useMemo(() => {
    return (
      isBluetoothEnabled &&
      isPermissionGiven &&
      isBluetoothPermissionGiven
    );
  }, [
    isBluetoothEnabled,
    isPermissionGiven,
    isBluetoothPermissionGiven,
  ]);

  return {
    isBluetoothEnabled,
    isPermissionGiven,
    isBluetoothPermissionGiven,
    allPermissionsAndBluetoothEnabled,
    checkPermissions,
    requestBluetoothPermissions,
    checkBluetoothPermissions,
    checkBluetoothStatus,
    checkBluetooth,
    requestBluetoothEnabling,
  };
};

export function BleManagerEnabler() {
  if (Platform.OS === 'ios') {
    return BluetoothStateManager.onStateChange(state => {
      if (state === 'PoweredOff') {
        Alert.alert(
          'Bluetooth Required',
          'Please turn on Bluetooth to Connect with OBD Device',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Open Settings',
              onPress: () => {
                setTimeout(() => {
                  Linking.openURL('App-prefs:root=Bluetooth');
                }, 500);
              },
            },
          ],
          {cancelable: true},
        );
      }
    }, true);
  } else {
    return BleManager.enableBluetooth();
  }
}

export function useDataOnlyBluetooth() {
  const ble = useContext(BluetoothContext);
  return {...ble};
}

export default useBluetooth;
