import React, {useEffect, useState} from 'react';
import {AppState} from '@own-react-native';
import {takeDecisionBasedOnStatus} from '@src/hooks/useBluetooth';
import useDebounce from '@src/hooks/useDebounce';
import {useDataOnlyBluetooth} from './hooks/useBluetooth';
import useBluetooth from './hooks/useBluetooth';
import BluetoothContext from './context/BluetoothContext';
import {setDataStreamingStatus} from '@src/store/obdLiveDataSlice/__OBDU';
import {useSelector} from 'react-redux';

// Constants
const STREAMING_TIMEOUT = 3000;
const BLUETOOTH_CHECK_DEBOUNCE = 1500;
const APP_STATE_DEBOUNCE = 300;

const App = () => {
  // App state and bluetooth
  const [appState, setAppState] = useState(AppState.currentState);
  const useBluetoothMadeProp = useDataOnlyBluetooth();
  const useBluetoothReal = useBluetooth();

  const dataStreamingStatus = useSelector(
    state => state?.obdLiveData?.dataStreamingStatus,
  );

  // Watch for changes to dataStreamingStatus
  useEffect(() => {
    if (!dataStreamingStatus) return;

    const timeoutId = setTimeout(() => {
      setDataStreamingStatus(false);
    }, STREAMING_TIMEOUT);

    return () => clearTimeout(timeoutId);
  }, [dataStreamingStatus]);

  // Handle bluetooth status check
  const checkBluetoothStatus = () => {
    const canCheckBluetooth =
      useBluetoothMadeProp?.isBluetoothEnabled !== undefined &&
      useBluetoothMadeProp?.isNotificationPermissionGiven !== undefined;

    if (canCheckBluetooth) {
      takeDecisionBasedOnStatus(
        useBluetoothMadeProp,
        navigation,
        currentScreenName,
      );
    }
  };

  // Handle app state changes
  const handleAppStateChange = nextAppState => {
    const isBecomingActive =
      (appState === 'inactive' || appState === 'background') &&
      nextAppState === 'active';

    if (isBecomingActive) {
      checkBluetoothStatus();
    }
    setAppState(nextAppState);
  };

  useDebounce(
    () => {
      const subscription = AppState.addEventListener(
        'change',
        handleAppStateChange,
      );
      return () => subscription.remove();
    },
    APP_STATE_DEBOUNCE,
    [appState],
  );

  useDebounce(checkBluetoothStatus, BLUETOOTH_CHECK_DEBOUNCE, [
    useBluetoothMadeProp,
  ]);

  return (
    <BluetoothContext.Provider value={useBluetoothReal}>
      {/* Minimal wrapper just to make the context available */}
    </BluetoothContext.Provider>
  );
};

export default App;
