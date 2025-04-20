// src/context/BluetoothProvider.tsx
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  FC,
} from 'react';
import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import type {
  Peripheral,
  BleManagerState,
  BleManagerDidUpdateValueForCharacteristicEvent,
  ChunkedResponse,
} from '../types';
import {
  BluetoothDispatchContext,
  BluetoothStateContext,
} from './BluetoothContext';
import { bluetoothReducer, initialState } from './BluetoothReducer';
import type { PeripheralWithPrediction, DeferredPromise } from '../types';
import { ELM327_PROMPT_BYTE, CommandReturnType } from '../constants';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

/**
 * Represents the state of a command being executed over Bluetooth.
 * This interface tracks the promise, timeout, and response data for each command.
 */
interface CommandExecutionState {
  /** Promise that will resolve with the command's response */
  promise: DeferredPromise<string | Uint8Array | ChunkedResponse>;
  /** Timeout ID for command expiration */
  timeoutId: NodeJS.Timeout | null;
  /** Buffer storing incoming response bytes */
  responseBuffer: number[];
  /** Array storing each chunk of response data as it arrives */
  responseChunks: number[][];
  /** Expected format of the command's response */
  expectedReturnType: 'string' | 'bytes' | 'chunked';
}

/**
 * Props for the BluetoothProvider component
 */
interface BluetoothProviderProps {
  /** Child components that will have access to Bluetooth context */
  children: React.ReactNode;
}

/**
 * Context for internal command control state.
 * This context is used to manage command execution state across the provider.
 */
const InternalCommandControlContext = createContext<
  | {
      /** Reference to the currently executing command */
      currentCommandRef: React.MutableRefObject<CommandExecutionState | null>;
    }
  | undefined
>(undefined);

// Set a display name for easier debugging
InternalCommandControlContext.displayName = 'InternalCommandControlContext';

/**
 * BluetoothProvider Component
 *
 * A React Context Provider that manages Bluetooth LE communication state and operations
 * for OBD-II vehicle diagnostics. This provider handles:
 *
 * - BLE device scanning and discovery
 * - Connection management
 * - Command execution and response handling
 * - Automatic error recovery
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <BluetoothProvider>
 *       <VehicleDiagnostics />
 *     </BluetoothProvider>
 *   );
 * }
 * ```
 *
 * @param props - Component props
 * @returns A provider component that makes Bluetooth functionality available to children
 */
export const BluetoothProvider: FC<BluetoothProviderProps> = ({ children }) => {
  // Validate React environment inside the component
  if (!React) {
    throw new Error(
      'React is not available in the runtime environment. This usually indicates a dependency resolution issue.',
    );
  }
  const [state, dispatch] = useReducer(bluetoothReducer, initialState);
  const currentCommandRef = useRef<CommandExecutionState | null>(null);

  /**
   * Handles incoming data from BLE characteristic notifications.
   * Processes response chunks and resolves command promises when complete.
   *
   * @param dataValue - Array of bytes received from the BLE device
   */
  const handleIncomingData = useCallback(
    (dataValue: number[]) => {
      if (state.isAwaitingResponse && currentCommandRef.current) {
        try {
          const commandState = currentCommandRef.current;
          commandState.responseChunks.push([...dataValue]);
          commandState.responseBuffer.push(...dataValue);

          const promptIndex =
            commandState.responseBuffer.indexOf(ELM327_PROMPT_BYTE);
          if (promptIndex !== -1) {
            const responseBytes = commandState.responseBuffer.slice(
              0,
              promptIndex,
            );
            const processedChunks = processResponseChunks(
              commandState.responseChunks,
              commandState.responseBuffer,
              promptIndex,
            );

            commandState.responseBuffer = [];
            commandState.responseChunks = [];

            if (commandState.timeoutId) {
              clearTimeout(commandState.timeoutId);
            }

            let response;
            switch (commandState.expectedReturnType) {
              case CommandReturnType.STRING:
                response = decodeResponse(responseBytes);
                break;
              case CommandReturnType.BYTES:
                response = Uint8Array.from(responseBytes);
                break;
              case CommandReturnType.CHUNKED:
                response = {
                  data: Uint8Array.from(responseBytes),
                  chunks: processedChunks.map(chunk => Uint8Array.from(chunk)),
                };
                break;
              default:
                response = decodeResponse(responseBytes);
            }

            commandState.promise.resolve(response);
            currentCommandRef.current = null;
            dispatch({ type: 'COMMAND_SUCCESS' });
          }
        } catch (error) {
          console.error(
            '[BluetoothProvider] Error processing incoming data:',
            error,
          );
          if (currentCommandRef.current?.promise) {
            currentCommandRef.current.promise.reject(handleError(error));
            currentCommandRef.current = null;
          }
          dispatch({ type: 'COMMAND_FAILURE', payload: handleError(error) });
        }
      }
    },
    [state.isAwaitingResponse],
  );

  /**
   * Processes response chunks to handle partial responses and remove prompt bytes.
   *
   * @param chunks - Array of received data chunks
   * @param flatBuffer - Complete response buffer
   * @param promptIndex - Index of the prompt byte in the flat buffer
   * @returns Processed chunks with prompt byte removed
   */
  const processResponseChunks = (
    chunks: number[][],
    flatBuffer: number[],
    promptIndex: number,
  ): number[][] => {
    const processedChunks = [...chunks];
    let runningLength = 0;

    for (let i = 0; i < processedChunks.length; i++) {
      const chunkLength = processedChunks[i].length;

      if (runningLength + chunkLength > promptIndex) {
        const promptPositionInChunk = promptIndex - runningLength;
        processedChunks[i] = processedChunks[i].slice(0, promptPositionInChunk);
        processedChunks.splice(i + 1);
        break;
      }

      runningLength += chunkLength;
    }

    return processedChunks;
  };

  /**
   * Decodes a byte array response into a string using TextDecoder.
   * Falls back to String.fromCharCode if TextDecoder fails.
   *
   * @param bytes - Array of bytes to decode
   * @returns Decoded string with whitespace trimmed
   */
  const decodeResponse = (bytes: number[]): string => {
    try {
      return new TextDecoder().decode(Uint8Array.from(bytes)).trim();
    } catch (e) {
      console.warn(
        '[BluetoothProvider] TextDecoder failed, falling back to fromCharCode:',
        e,
      );
      return String.fromCharCode(...bytes).trim();
    }
  };

  /**
   * Ensures consistent error handling by converting any error type to Error.
   *
   * @param error - The error to handle
   * @returns A standardized Error object
   */
  const handleError = (error: unknown): Error => {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  };

  // Use refs to store listeners to ensure they are removed correctly
  const listenersRef = useRef<EmitterSubscription[]>([]);

  /**
   * Initializes the BLE manager and checks initial Bluetooth state.
   * This effect runs once when the component mounts.
   */
  useEffect(() => {
    console.info('[BluetoothProvider] Initializing BleManager...');

    BleManager.start({ showAlert: false })
      .then(() => {
        console.info('[BluetoothProvider] BleManager started successfully.');
        dispatch({ type: 'SET_INITIALIZING', payload: false });
        BleManager.checkState();
      })
      .catch((error: Error) => {
        console.error('[BluetoothProvider] BleManager failed to start:', error);
        dispatch({ type: 'SET_INITIALIZING', payload: false });
        dispatch({
          type: 'SET_ERROR',
          payload: new Error(`BleManager failed to start: ${error}`),
        });
      });
  }, []);

  /**
   * Sets up BLE event listeners for managing device state and communication.
   * Handles state changes, device discovery, disconnections, and data notifications.
   * Re-runs when the connected device ID changes to ensure proper disconnect handling.
   */
  useEffect(() => {
    const listeners: EmitterSubscription[] = [];
    console.info('[BluetoothProvider] Setting up BLE listeners...');

    // Bluetooth State Change Listener
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDidUpdateState',
        (args: { state: BleManagerState }) => {
          console.info(
            `[BluetoothProvider] BleManagerDidUpdateState: ${args.state}`,
          );
          const isBtOn = args.state === 'on';
          dispatch({ type: 'SET_BLUETOOTH_STATE', payload: isBtOn });
          if (!isBtOn) {
            console.warn('[BluetoothProvider] Bluetooth is OFF.');
          }
        },
      ),
    );

    // Device Discovery Listener
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        (peripheral: Peripheral) => {
          const name = peripheral.name?.toUpperCase() || '';
          const likelyOBDKeywords = [
            'OBD',
            'ELM',
            'VLINK',
            'SCAN',
            'ICAR',
            'KONNWEI',
          ];
          const isLikelyOBD = likelyOBDKeywords.some(keyword =>
            name.includes(keyword),
          );

          const peripheralWithPrediction: PeripheralWithPrediction = {
            ...peripheral,
            isLikelyOBD,
          };
          dispatch({ type: 'DEVICE_FOUND', payload: peripheralWithPrediction });
        },
      ),
    );

    // Scan Completion Listener
    listeners.push(
      bleManagerEmitter.addListener('BleManagerStopScan', () => {
        console.info('[BluetoothProvider] BleManagerStopScan received.');
        dispatch({ type: 'SCAN_STOP' });
      }),
    );

    // Device Disconnection Listener
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        (data: { peripheral: string }) => {
          console.warn(
            `[BluetoothProvider] BleManagerDisconnectPeripheral: ${data.peripheral}`,
          );
          if (state.connectedDevice?.id === data.peripheral) {
            if (currentCommandRef.current) {
              console.error(
                '[BluetoothProvider] Rejecting command due to disconnect.',
              );
              currentCommandRef.current.promise.reject(
                new Error('Device disconnected during command.'),
              );
              if (currentCommandRef.current.timeoutId) {
                clearTimeout(currentCommandRef.current.timeoutId);
              }
              currentCommandRef.current.responseBuffer = [];
              currentCommandRef.current = null;
            }
            dispatch({ type: 'DEVICE_DISCONNECTED' });
          }
        },
      ),
    );

    // Data Notification Listener
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        (data: BleManagerDidUpdateValueForCharacteristicEvent) => {
          handleIncomingData(data.value);
        },
      ),
    );

    listenersRef.current = listeners;

    return () => {
      console.info('[BluetoothProvider] Removing BLE listeners...');
      listenersRef.current.forEach(listener => listener.remove());
      listenersRef.current = [];
    };
  }, [state.connectedDevice?.id, handleIncomingData]);

  /**
   * Memoized value for the command control context.
   * This prevents unnecessary re-renders of context consumers.
   */
  const commandControlValue = useMemo(
    () => ({
      currentCommandRef,
    }),
    [],
  );

  return (
    <BluetoothStateContext.Provider value={state}>
      <BluetoothDispatchContext.Provider value={dispatch}>
        <InternalCommandControlContext.Provider value={commandControlValue}>
          {children}
        </InternalCommandControlContext.Provider>
      </BluetoothDispatchContext.Provider>
    </BluetoothStateContext.Provider>
  );
};

/**
 * Internal hook for accessing the command control context.
 * This hook provides access to the internal command execution state
 * and is only meant to be used by the library's internal components.
 *
 * @internal
 * @throws {Error} When used outside of a BluetoothProvider
 * @returns Command control context object containing the current command reference
 *
 * @example
 * ```typescript
 * // Internal usage only
 * function InternalComponent() {
 *   const { currentCommandRef } = useInternalCommandControl();
 *   // Access command state...
 * }
 * ```
 */
export const useInternalCommandControl = () => {
  const context = React.useContext(InternalCommandControlContext);
  if (context === undefined) {
    throw new Error(
      'useInternalCommandControl must be used within a BluetoothProvider',
    );
  }
  return context;
};
