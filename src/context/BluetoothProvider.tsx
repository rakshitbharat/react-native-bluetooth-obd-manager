// src/context/BluetoothProvider.tsx
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
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

interface CommandExecutionState {
  promise: DeferredPromise<string | Uint8Array | ChunkedResponse>;
  timeoutId: NodeJS.Timeout | null;
  responseBuffer: number[];
  responseChunks: number[][];
  expectedReturnType: 'string' | 'bytes' | 'chunked';
}

interface BluetoothProviderProps {
  children: React.ReactNode;
}

const InternalCommandControlContext = createContext<
  | {
      currentCommandRef: React.MutableRefObject<CommandExecutionState | null>;
    }
  | undefined
>(undefined);

InternalCommandControlContext.displayName = 'InternalCommandControlContext';

/**
 * BluetoothProvider Component
 * Manages Bluetooth state and provides BLE functionality to child components
 */
export function BluetoothProvider({
  children,
}: BluetoothProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(bluetoothReducer, initialState);
  const currentCommandRef = useRef<CommandExecutionState | null>(null);

  const handleIncomingData = useCallback(
    (dataValue: number[]) => {
      if (state.isAwaitingResponse && currentCommandRef.current) {
        try {
          const commandState = currentCommandRef.current;

          // Store the chunk as-is in the chunks array
          commandState.responseChunks.push([...dataValue]);

          // Also add to flat buffer as before
          commandState.responseBuffer.push(...dataValue);

          const promptIndex =
            commandState.responseBuffer.indexOf(ELM327_PROMPT_BYTE);
          if (promptIndex !== -1) {
            // Extract the complete response (excluding the prompt byte)
            const responseBytes = commandState.responseBuffer.slice(
              0,
              promptIndex,
            );

            // Process the response chunks - find and trim the chunk containing the prompt
            const processedChunks = processResponseChunks(
              commandState.responseChunks,
              commandState.responseBuffer,
              promptIndex,
            );

            // Clear buffers
            commandState.responseBuffer = [];
            commandState.responseChunks = [];

            if (commandState.timeoutId) {
              clearTimeout(commandState.timeoutId);
            }

            // Create the appropriate response based on expected return type
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

  // Helper function to process response chunks and remove the prompt byte
  const processResponseChunks = (
    chunks: number[][],
    flatBuffer: number[],
    promptIndex: number,
  ): number[][] => {
    const processedChunks = [...chunks]; // Copy array to avoid mutation

    // Find which chunk contains the prompt byte
    let runningLength = 0;
    for (let i = 0; i < processedChunks.length; i++) {
      const chunkLength = processedChunks[i].length;

      if (runningLength + chunkLength > promptIndex) {
        // This chunk contains the prompt
        const promptPositionInChunk = promptIndex - runningLength;

        // Trim this chunk to exclude the prompt byte
        processedChunks[i] = processedChunks[i].slice(0, promptPositionInChunk);

        // Remove any chunks after this one (they would be after the prompt)
        processedChunks.splice(i + 1);
        break;
      }

      runningLength += chunkLength;
    }

    return processedChunks;
  };

  // Helper function to decode response
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

  // Fix error rejection types
  const handleError = (error: unknown): Error => {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  };

  // Use refs to store listeners to ensure they are removed correctly
  const listenersRef = useRef<EmitterSubscription[]>([]);

  // Effect 1: Initialize BleManager on mount
  useEffect(() => {
    console.info('[BluetoothProvider] Initializing BleManager...');
    // Start BleManager
    BleManager.start({ showAlert: false })
      .then(() => {
        console.info('[BluetoothProvider] BleManager started successfully.');
        dispatch({ type: 'SET_INITIALIZING', payload: false });
        // Optionally check initial Bluetooth state after start
        BleManager.checkState();
      })
      .catch((error: Error) => {
        // Add Error type annotation
        console.error('[BluetoothProvider] BleManager failed to start:', error);
        dispatch({ type: 'SET_INITIALIZING', payload: false });
        dispatch({
          type: 'SET_ERROR',
          payload: new Error(`BleManager failed to start: ${error}`),
        });
      });
  }, []); // Runs only once on mount

  // Effect 2: Set up BleManager event listeners
  useEffect(() => {
    const listeners: EmitterSubscription[] = []; // Temporary array for this effect run

    console.info('[BluetoothProvider] Setting up BLE listeners...');

    // Listener for Bluetooth State Changes (ON/OFF)
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

    // Listener for Discovered Devices during Scan
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        (peripheral: Peripheral) => {
          // Add basic isLikelyOBD heuristic here (TODO: Refine this logic)
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
            isLikelyOBD: isLikelyOBD, // Set the flag
          };
          // console.info(`[BluetoothProvider] Discovered: ${peripheral.name || peripheral.id}, LikelyOBD: ${isLikelyOBD}`);
          dispatch({ type: 'DEVICE_FOUND', payload: peripheralWithPrediction });
        },
      ),
    );

    // Listener for Scan Stop Event
    listeners.push(
      bleManagerEmitter.addListener('BleManagerStopScan', () => {
        console.info('[BluetoothProvider] BleManagerStopScan received.');
        dispatch({ type: 'SCAN_STOP' });
      }),
    );

    // Listener for Device Disconnection (Expected or Unexpected)
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

    // Listener for Incoming Data Notifications
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        (data: BleManagerDidUpdateValueForCharacteristicEvent) => {
          handleIncomingData(data.value);
        },
      ),
    );

    listenersRef.current = listeners; // Store listeners in ref

    // Cleanup function: Remove all listeners when the component unmounts
    return () => {
      console.info('[BluetoothProvider] Removing BLE listeners...');
      listenersRef.current.forEach(listener => listener.remove());
      listenersRef.current = []; // Clear the ref
    };
    // Re-run this effect if the connectedDevice ID changes,
    // primarily to ensure the disconnect listener comparison is up-to-date.
  }, [state.connectedDevice?.id, handleIncomingData]);

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
}

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
    throw new Error(
      'useInternalCommandControl must be used within a BluetoothProvider',
    );
  }
  return context;
};
