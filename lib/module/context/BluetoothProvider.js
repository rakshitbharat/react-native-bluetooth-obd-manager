// src/context/BluetoothProvider.tsx

import React, { useEffect, useReducer, useRef, useCallback, createContext, useMemo } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import BleManager from 'react-native-ble-manager';
import { BluetoothDispatchContext, BluetoothStateContext } from './BluetoothContext';
import { bluetoothReducer, initialState } from './BluetoothReducer';
import { ELM327_PROMPT_BYTE } from '../constants';

// Get the BleManager native module and initialize an event emitter
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

// --- Helper type for Command Refs ---

const InternalCommandControlContext = /*#__PURE__*/createContext(undefined);
InternalCommandControlContext.displayName = 'InternalCommandControlContext';

/**
 * Provider component that manages Bluetooth state and event listeners.
 *
 * Initializes BleManager and sets up global event listeners for:
 * - Bluetooth state changes
 * - Device discovery during scanning
 * - Connection/disconnection events
 * - Incoming data notifications
 *
 * Wrap your application with this provider to use the `useBluetooth` hook.
 *
 * @param {BluetoothProviderProps} props Component props
 * @param {ReactNode} props.children Child components that will have access to the Bluetooth context
 */
export const BluetoothProvider = ({
  children
}) => {
  var _state$connectedDevic2;
  const [state, dispatch] = useReducer(bluetoothReducer, initialState);

  // Replace multiple command refs with single execution state ref
  const currentCommandRef = useRef(null);
  const handleIncomingData = useCallback(dataValue => {
    if (state.isAwaitingResponse && currentCommandRef.current) {
      try {
        const commandState = currentCommandRef.current;
        commandState.responseBuffer.push(...dataValue);
        const promptIndex = commandState.responseBuffer.indexOf(ELM327_PROMPT_BYTE);
        if (promptIndex !== -1) {
          const responseBytes = commandState.responseBuffer.slice(0, promptIndex);
          commandState.responseBuffer = []; // Clear buffer

          if (commandState.timeoutId) {
            clearTimeout(commandState.timeoutId);
          }
          const response = commandState.expectedReturnType === 'bytes' ? Uint8Array.from(responseBytes) : decodeResponse(responseBytes);
          commandState.promise.resolve(response);
          currentCommandRef.current = null;
          dispatch({
            type: 'COMMAND_SUCCESS'
          });
        }
      } catch (error) {
        var _currentCommandRef$cu;
        console.error('[BluetoothProvider] Error processing incoming data:', error);
        if ((_currentCommandRef$cu = currentCommandRef.current) !== null && _currentCommandRef$cu !== void 0 && _currentCommandRef$cu.promise) {
          currentCommandRef.current.promise.reject(handleError(error));
          currentCommandRef.current = null;
        }
        dispatch({
          type: 'COMMAND_FAILURE',
          payload: handleError(error)
        });
      }
    }
  }, [state.isAwaitingResponse]);

  // Helper function to decode response
  const decodeResponse = bytes => {
    try {
      return new TextDecoder().decode(Uint8Array.from(bytes)).trim();
    } catch (e) {
      console.warn('[BluetoothProvider] TextDecoder failed, falling back to fromCharCode:', e);
      return String.fromCharCode(...bytes).trim();
    }
  };

  // Fix error rejection types
  const handleError = error => {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  };

  // Use refs to store listeners to ensure they are removed correctly
  const listenersRef = useRef([]);

  // Effect 1: Initialize BleManager on mount
  useEffect(() => {
    console.info('[BluetoothProvider] Initializing BleManager...');
    // Start BleManager
    BleManager.start({
      showAlert: false
    }).then(() => {
      console.info('[BluetoothProvider] BleManager started successfully.');
      dispatch({
        type: 'SET_INITIALIZING',
        payload: false
      });
      // Optionally check initial Bluetooth state after start
      BleManager.checkState();
    }).catch(error => {
      // Add Error type annotation
      console.error('[BluetoothProvider] BleManager failed to start:', error);
      dispatch({
        type: 'SET_INITIALIZING',
        payload: false
      });
      dispatch({
        type: 'SET_ERROR',
        payload: new Error(`BleManager failed to start: ${error}`)
      });
    });
  }, []); // Runs only once on mount

  // Effect 2: Set up BleManager event listeners
  useEffect(() => {
    const listeners = []; // Temporary array for this effect run

    console.info('[BluetoothProvider] Setting up BLE listeners...');

    // Listener for Bluetooth State Changes (ON/OFF)
    listeners.push(bleManagerEmitter.addListener('BleManagerDidUpdateState', args => {
      console.info(`[BluetoothProvider] BleManagerDidUpdateState: ${args.state}`);
      const isBtOn = args.state === 'on';
      dispatch({
        type: 'SET_BLUETOOTH_STATE',
        payload: isBtOn
      });
      if (!isBtOn) {
        console.warn('[BluetoothProvider] Bluetooth is OFF.');
      }
    }));

    // Listener for Discovered Devices during Scan
    listeners.push(bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', peripheral => {
      var _peripheral$name;
      // Add basic isLikelyOBD heuristic here (TODO: Refine this logic)
      const name = ((_peripheral$name = peripheral.name) === null || _peripheral$name === void 0 ? void 0 : _peripheral$name.toUpperCase()) || '';
      const likelyOBDKeywords = ['OBD', 'ELM', 'VLINK', 'SCAN', 'ICAR', 'KONNWEI'];
      const isLikelyOBD = likelyOBDKeywords.some(keyword => name.includes(keyword));
      const peripheralWithPrediction = {
        ...peripheral,
        isLikelyOBD: isLikelyOBD // Set the flag
      };
      // console.info(`[BluetoothProvider] Discovered: ${peripheral.name || peripheral.id}, LikelyOBD: ${isLikelyOBD}`);
      dispatch({
        type: 'DEVICE_FOUND',
        payload: peripheralWithPrediction
      });
    }));

    // Listener for Scan Stop Event
    listeners.push(bleManagerEmitter.addListener('BleManagerStopScan', () => {
      console.info('[BluetoothProvider] BleManagerStopScan received.');
      dispatch({
        type: 'SCAN_STOP'
      });
    }));

    // Listener for Device Disconnection (Expected or Unexpected)
    listeners.push(bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', data => {
      var _state$connectedDevic;
      console.warn(`[BluetoothProvider] BleManagerDisconnectPeripheral: ${data.peripheral}`);
      if (((_state$connectedDevic = state.connectedDevice) === null || _state$connectedDevic === void 0 ? void 0 : _state$connectedDevic.id) === data.peripheral) {
        if (currentCommandRef.current) {
          console.error('[BluetoothProvider] Rejecting command due to disconnect.');
          currentCommandRef.current.promise.reject(new Error('Device disconnected during command.'));
          if (currentCommandRef.current.timeoutId) {
            clearTimeout(currentCommandRef.current.timeoutId);
          }
          currentCommandRef.current.responseBuffer = [];
          currentCommandRef.current = null;
        }
        dispatch({
          type: 'DEVICE_DISCONNECTED'
        });
      }
    }));

    // Listener for Incoming Data Notifications
    listeners.push(bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', data => {
      handleIncomingData(data.value);
    }));
    listenersRef.current = listeners; // Store listeners in ref

    // Cleanup function: Remove all listeners when the component unmounts
    return () => {
      console.info('[BluetoothProvider] Removing BLE listeners...');
      listenersRef.current.forEach(listener => listener.remove());
      listenersRef.current = []; // Clear the ref
    };
    // Re-run this effect if the connectedDevice ID changes,
    // primarily to ensure the disconnect listener comparison is up-to-date.
  }, [(_state$connectedDevic2 = state.connectedDevice) === null || _state$connectedDevic2 === void 0 ? void 0 : _state$connectedDevic2.id, handleIncomingData]);

  // Memoize context value
  const commandControlValue = useMemo(() => ({
    currentCommandRef
  }), []);
  return /*#__PURE__*/React.createElement(BluetoothStateContext.Provider, {
    value: state
  }, /*#__PURE__*/React.createElement(BluetoothDispatchContext.Provider, {
    value: dispatch
  }, /*#__PURE__*/React.createElement(InternalCommandControlContext.Provider, {
    value: commandControlValue
  }, children)));
};

/**
 * Internal hook for accessing the command control context.
 * This is used by the BluetoothProvider to manage command execution state.
 * Not meant for external consumption.
 *
 * @internal
 * @returns Command control context containing the current command reference
 * @throws {Error} If used outside of a BluetoothProvider
 */
export const useInternalCommandControl = () => {
  const context = React.useContext(InternalCommandControlContext);
  if (context === undefined) {
    throw new Error('useInternalCommandControl must be used within a BluetoothProvider');
  }
  return context;
};
//# sourceMappingURL=BluetoothProvider.js.map