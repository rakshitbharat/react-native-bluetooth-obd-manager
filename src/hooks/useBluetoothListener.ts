import { useCallback, useEffect } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import type {
  BleManagerDidUpdateValueForCharacteristicEvent,
  CommandExecutionState,
  BluetoothAction,
} from '../types';
import { log } from '../utils/logger';
import { ELM327_COMMAND_TERMINATOR_ASCII } from '../constants';

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

const MAX_RETAINED_RESPONSES = 3;

/**
 * Custom hook to manage the BleManagerDidUpdateValueForCharacteristic listener
 * and accumulate incoming data chunks for command responses.
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

          // --- New logic for receivedRawChunksAll ---
          const currentIndex = commandState.currentResponseIndex;

          // Ensure the array for the current response index exists in receivedRawChunksAll
          if (!commandState.receivedRawChunksAll[currentIndex]) {
            log.warn(
              `[useBluetoothListener] Response array at index ${currentIndex} in receivedRawChunksAll not initialized. Initializing.`,
            );
            commandState.receivedRawChunksAll[currentIndex] = [];
          }

          // Append the new chunk to the current response's chunk array in receivedRawChunksAll
          // Use spread syntax directly in push to add individual numbers
          commandState.receivedRawChunksAll[currentIndex].push(...value);
          log.debug(
            `[useBluetoothListener] Appended chunk to receivedRawChunksAll index ${currentIndex}. Total chunks for this response: ${commandState.receivedRawChunksAll[currentIndex].length}`,
          );

          // Check if the terminator character ('>', ASCII 62) is present in the current chunk
          if (value.includes(ELM327_COMMAND_TERMINATOR_ASCII)) {
            log.info(
              `[useBluetoothListener] Terminator found in chunk for response index ${currentIndex}.`,
            );

            // Increment the index to prepare for the next response
            let nextIndex = commandState.currentResponseIndex + 1;

            // Initialize the array for the *next* response index in receivedRawChunksAll
            commandState.receivedRawChunksAll[nextIndex] = [];

            // --- Enforce the limit ---
            if (
              commandState.receivedRawChunksAll.length > MAX_RETAINED_RESPONSES
            ) {
              log.info(
                `[useBluetoothListener] Exceeded max responses (${MAX_RETAINED_RESPONSES}). Removing oldest.`,
              );
              // Keep only the last MAX_RETAINED_RESPONSES elements
              commandState.receivedRawChunksAll =
                commandState.receivedRawChunksAll.slice(
                  -MAX_RETAINED_RESPONSES,
                );
              // Adjust the next index to be the last index of the sliced array
              nextIndex = commandState.receivedRawChunksAll.length - 1;
            }

            // Update the current response index
            commandState.currentResponseIndex = nextIndex;

            log.info(
              `[useBluetoothListener] Updated response index to ${commandState.currentResponseIndex}. Total responses stored: ${commandState.receivedRawChunksAll.length}.`,
            );

            // --- Promise resolution logic is still deferred ---
          }
        } catch (error) {
          log.error(
            '[useBluetoothListener] Error processing incoming data:',
            error,
          );
          // Keep error handling for the promise if an unexpected error occurs here
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
