import { useEffect } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import type {
  BleManagerDidUpdateValueForCharacteristicEvent,
  CommandExecutionState,
  BluetoothAction,
  InternalCommandResponse, // Import InternalCommandResponse
} from '../types';
import { log } from '../utils/logger';
import { ELM327_COMMAND_TERMINATOR_ASCII } from '../constants';
import { bytesToUint8Array } from '../utils/byteUtils'; // Import bytesToUint8Array

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
  const handleIncomingData = (data: BleManagerDidUpdateValueForCharacteristicEvent) => {
      const value = data.value; // This is number[]
      log.info(
        '[useBluetoothListener] Received data chunk:',
        JSON.stringify(value),
      );

      if (currentCommandRef.current) {
        try {
          const commandState = currentCommandRef.current;
          const currentIndex = commandState.currentResponseIndex;

          // Ensure the array for the current response index exists
          if (!commandState.receivedRawChunksAll[currentIndex]) {
            log.warn(
              `[useBluetoothListener] Response array at index ${currentIndex} not initialized. Initializing.`,
            );
            commandState.receivedRawChunksAll[currentIndex] = [];
          }

          // Append the new chunk to the current response's chunk array
          commandState.receivedRawChunksAll[currentIndex].push(...value);
          log.debug(
            `[useBluetoothListener] Appended chunk to receivedRawChunksAll index ${currentIndex}. Total bytes for this response: ${commandState.receivedRawChunksAll[currentIndex].length}`,
          );

          // Check if the terminator character ('>', ASCII 62) is present
          if (value.includes(ELM327_COMMAND_TERMINATOR_ASCII)) {
            log.info(
              `[useBluetoothListener] Terminator found in chunk for response index ${currentIndex}. Resolving command promise.`,
            );

            // --- Resolve the Promise ---
            if (commandState.promise) {
              // Prepare the response object
              // Get the flat array of all raw bytes for the *completed* response index
              const completedRawBytes: number[] = commandState.receivedRawChunksAll[currentIndex];

              // Create the InternalCommandResponse based on the flat array structure
              const internalResponse: InternalCommandResponse = {
                 // Treat the flat array as the bytes of a single chunk
                 chunks: [bytesToUint8Array(completedRawBytes)], // Array containing one Uint8Array
                 // Treat the flat array as the raw data of a single chunk
                 rawResponse: [completedRawBytes], // Array containing one number[]
              };

              commandState.promise.resolve(internalResponse);
              // Note: We resolve *before* potentially clearing the ref in executeCommandInternal
              // or incrementing the index here. executeCommandInternal will handle the ref clearing.
            } else {
              log.warn(
                `[useBluetoothListener] Terminator found, but no active promise in commandState for index ${currentIndex}.`,
              );
            }

            // --- Index Management (Keep after potential resolution) ---
            // Increment the index to prepare for the next potential response (less relevant if commands don't overlap responses)
            let nextIndex = commandState.currentResponseIndex + 1;

            // Initialize the array for the *next* response index
            // Check bounds before initializing
             if (nextIndex < MAX_RETAINED_RESPONSES) { // Only initialize if within bounds initially
               commandState.receivedRawChunksAll[nextIndex] = [];
             }


            // --- Enforce the limit ---
            if (
              commandState.receivedRawChunksAll.length > MAX_RETAINED_RESPONSES
            ) {
              log.info(
                `[useBluetoothListener] Exceeded max responses (${MAX_RETAINED_RESPONSES}). Removing oldest.`,
              );
              commandState.receivedRawChunksAll =
                commandState.receivedRawChunksAll.slice(
                  -MAX_RETAINED_RESPONSES,
                );
              // Adjust the next index relative to the *new* array length
              nextIndex = commandState.receivedRawChunksAll.length; // Point to the position *after* the last element
               // Ensure the slot for the *next* command exists after slicing
               if (nextIndex < MAX_RETAINED_RESPONSES && !commandState.receivedRawChunksAll[nextIndex]) {
                 commandState.receivedRawChunksAll[nextIndex] = [];
               }
            }

            // Update the current response index *after* resolving the previous one
            commandState.currentResponseIndex = nextIndex;


            log.info(
              `[useBluetoothListener] Updated response index to ${commandState.currentResponseIndex}. Total responses stored: ${commandState.receivedRawChunksAll.length}.`,
            );

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
    };

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
  }, []);
};
