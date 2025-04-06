"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useInternalCommandControl = exports.default = exports.BluetoothProvider = void 0;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _reactNativeBleManager = _interopRequireDefault(require("react-native-ble-manager"));
var _BluetoothContext = require("./BluetoothContext");
var _BluetoothReducer = require("./BluetoothReducer");
var _constants = require("../constants");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
// src/context/BluetoothProvider.tsx

// Get the BleManager native module and initialize an event emitter
const BleManagerModule = _reactNative.NativeModules.BleManager;
const bleManagerEmitter = new _reactNative.NativeEventEmitter(BleManagerModule);

// --- Helper type for Command Refs ---

const InternalCommandControlContext = /*#__PURE__*/(0, _react.createContext)(undefined);
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
const BluetoothProvider = ({
  children
}) => {
  var _state$connectedDevic2;
  const [state, dispatch] = (0, _react.useReducer)(_BluetoothReducer.bluetoothReducer, _BluetoothReducer.initialState);

  // Replace multiple command refs with single execution state ref
  const currentCommandRef = (0, _react.useRef)(null);
  const handleIncomingData = (0, _react.useCallback)(dataValue => {
    if (state.isAwaitingResponse && currentCommandRef.current) {
      try {
        const commandState = currentCommandRef.current;
        commandState.responseBuffer.push(...dataValue);
        const promptIndex = commandState.responseBuffer.indexOf(_constants.ELM327_PROMPT_BYTE);
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
        console.error('[BluetoothProvider] Error processing incoming data:', error);
        if (currentCommandRef.current) {
          currentCommandRef.current.promise.reject(error);
          currentCommandRef.current = null;
        }
        dispatch({
          type: 'COMMAND_FAILURE',
          payload: error
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

  // Use refs to store listeners to ensure they are removed correctly
  const listenersRef = (0, _react.useRef)([]); // Using any for listener type flexibility

  // Effect 1: Initialize BleManager on mount
  (0, _react.useEffect)(() => {
    console.info('[BluetoothProvider] Initializing BleManager...');
    // Start BleManager
    _reactNativeBleManager.default.start({
      showAlert: false
    }).then(() => {
      console.info('[BluetoothProvider] BleManager started successfully.');
      dispatch({
        type: 'SET_INITIALIZING',
        payload: false
      });
      // Optionally check initial Bluetooth state after start
      _reactNativeBleManager.default.checkState();
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
  (0, _react.useEffect)(() => {
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
  const commandControlValue = (0, _react.useMemo)(() => ({
    currentCommandRef
  }), []);
  return /*#__PURE__*/_react.default.createElement(_BluetoothContext.BluetoothStateContext.Provider, {
    value: state
  }, /*#__PURE__*/_react.default.createElement(_BluetoothContext.BluetoothDispatchContext.Provider, {
    value: dispatch
  }, /*#__PURE__*/_react.default.createElement(InternalCommandControlContext.Provider, {
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
exports.BluetoothProvider = BluetoothProvider;
const useInternalCommandControl = () => {
  const context = _react.default.useContext(InternalCommandControlContext);
  if (context === undefined) {
    throw new Error('useInternalCommandControl must be used within a BluetoothProvider');
  }
  return context;
};

// Add type declaration for BleManager
exports.useInternalCommandControl = useInternalCommandControl;
var _default = exports.default = _reactNativeBleManager.default;
//# sourceMappingURL=BluetoothProvider.js.map