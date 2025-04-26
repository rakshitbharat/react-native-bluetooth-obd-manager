import { useCallback, useEffect } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import type {
  BleManagerDidUpdateValueForCharacteristicEvent,
  CommandExecutionState,
  InternalCommandResponse,
  BluetoothAction,
} from '../types';
import { log } from '../utils/logger';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

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
  // Handle specific BleError structure if needed, otherwise generic
  if (
    typeof error === 'object' &&
    error !== null &&
    'errorCode' in error &&
    'message' in error
  ) {
    return new Error(
      `BLE Error (${(error as { errorCode: string; message: string }).errorCode}): ${
        (error as { message: string }).message
      }`,
    );
  }
  return new Error(String(error));
};

/**
 * Custom hook to manage the BleManagerDidUpdateValueForCharacteristic listener
 * and handle incoming data for command responses.
 *
 * @internal - Intended for use within BluetoothProvider.
 *
 * @param currentCommandRef - Ref object holding the state of the currently executing command.
 * @param dispatch - Dispatch function for the Bluetooth state reducer.
 */
export const useBluetoothListener = (
  currentCommandRef: React.MutableRefObject<CommandExecutionState | null>,
  dispatch: React.Dispatch<BluetoothAction>,
): void => {
  const handleIncomingData = useCallback(
    (data: BleManagerDidUpdateValueForCharacteristicEvent) => {
      const value = data.value; // This is number[]
      log.info(
        '[useBluetoothListener] Received data chunk:',
        JSON.stringify(value),
      );

      if (currentCommandRef.current) {
        try {
          const commandState = currentCommandRef.current;

          // Store raw number arrays
          // Ensure receivedRawChunks exists on the type!
          if (!commandState.receivedRawChunks) {
            commandState.receivedRawChunks = [];
          }
          commandState.receivedRawChunks.push([...value]);

          // Check if the terminator character ('>', ASCII 62 or 0x3E) is present
          if (value.includes(62)) {
            // 62 is the ASCII code for '>'
            const { promise } = commandState;

            // Prepare the internal response object
            const internalResponse: InternalCommandResponse = {
              // Map receivedRawChunks to Uint8Array
              chunks: commandState.receivedRawChunks.map(
                chunk => new Uint8Array(chunk),
              ),
              rawResponse: commandState.receivedRawChunks, // Keep the raw number[][]
            };

            // Clear the current command state *before* resolving
            currentCommandRef.current = null;
            dispatch({ type: 'COMMAND_SUCCESS' });

            log.info(
              '[useBluetoothListener] Command finished. Resolving internal promise with:',
              JSON.stringify(internalResponse),
            );

            // Resolve the promise with the internal structure
            promise.resolve(internalResponse);
          }
        } catch (error) {
          log.error(
            '[useBluetoothListener] Error processing incoming data:',
            error,
          );
          if (currentCommandRef.current?.promise) {
            const formattedError = handleError(error);
            currentCommandRef.current.promise.reject(formattedError);
            currentCommandRef.current = null; // Clear ref on error
          }
          dispatch({ type: 'COMMAND_FAILURE', payload: handleError(error) });
        }
      } else {
        log.debug(
          '[useBluetoothListener] Received data with no active command:',
          value,
        );
      }
    },
    [currentCommandRef, dispatch], // Dependencies: ref and dispatch
  );

  // Effect to setup and cleanup the listener
  useEffect(() => {
    log.info(
      '[useBluetoothListener] Setting up BLE data notification listener...',
    );

    const dataListener: EmitterSubscription = bleManagerEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      handleIncomingData,
    );

    return () => {
      log.info(
        '[useBluetoothListener] Removing BLE data notification listener...',
      );
      dataListener.remove();
    };
  }, [handleIncomingData]); // Re-run if handleIncomingData changes
};
