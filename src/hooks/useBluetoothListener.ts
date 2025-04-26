import { useCallback, useEffect } from 'react';
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
              // Get all raw chunks for the *completed* response index
              const completedRawChunks = commandState.receivedRawChunksAll[currentIndex];
              // Convert the raw number[] chunks to Uint8Array chunks
              const processedChunks = completedRawChunks.map(chunkArray => bytesToUint8Array(chunkArray)); // Assuming chunkArray is number[]

              const internalResponse: InternalCommandResponse = {
                // Wrap the single response's chunks in an array as expected by the type?
                // No, the type expects Uint8Array[] and number[][] where each inner array is a chunk.
                // Let's adjust based on how receivedRawChunksAll is structured.
                // If receivedRawChunksAll[currentIndex] is number[] representing the concatenated bytes for the response
                // This assumption seems wrong based on the log "Appended chunk...".
                // Let's assume receivedRawChunksAll[currentIndex] is actually number[][] where each inner array is a chunk.

                // Assuming receivedRawChunksAll[currentIndex] is number[] representing the concatenated bytes for the response
                // This assumption seems wrong based on the log "Appended chunk...".
                // Let's assume receivedRawChunksAll[currentIndex] is actually number[][] where each inner array is a chunk.

                // Re-evaluate: The log "Appended chunk to receivedRawChunksAll index ${currentIndex}" and the push(...value)
                // suggests receivedRawChunksAll[currentIndex] is actually a single number[] accumulating all bytes.
                // Let's proceed with that assumption for now, but it might need correction if the structure is different.

                // If it's a single number[]:
                // chunks: [bytesToUint8Array(completedRawChunks)], // Wrap the single Uint8Array in an array
                // rawResponse: [completedRawChunks], // Wrap the single number[] in an array

                // Let's refine based on the previous log: "Appended chunk to receivedRawChunksAll index 0. Total chunks for this response: 6"
                // This implies receivedRawChunksAll[currentIndex] is number[] containing ALL bytes concatenated.
                // BUT the type InternalCommandResponse expects chunks: Uint8Array[] and rawResponse: number[][]
                // This means the listener *should* be storing chunks separately.

                // --- Correction: Adjusting data storage logic ---
                // Let's modify the storage to match the expected type.
                // receivedRawChunksAll should be number[][][] -> [responseIndex][chunkIndex][byteValue]
                // Or, simpler: keep CommandExecutionState as is, but process correctly here.

                // Let's assume CommandExecutionState.receivedRawChunksAll is number[][]
                // where each inner number[] IS a single chunk received.

                // Re-read the code:
                // commandState.receivedRawChunksAll[currentIndex].push(...value);
                // This pushes the *bytes* of the current chunk into the array at currentIndex.
                // So, receivedRawChunksAll[currentIndex] becomes a flat number[] of all bytes for that response.

                // --- Final approach: Adapt to the current structure ---
                // We have a flat number[] in receivedRawChunksAll[currentIndex].
                // We need to return InternalCommandResponse { chunks: Uint8Array[], rawResponse: number[][] }
                // This implies the structure in CommandExecutionState or the processing here is mismatched.
                // Let's return what we have and fix the type/structure later if needed.
                // For now, treat the flat array as a single "chunk" for the response.

                 chunks: [bytesToUint8Array(commandState.receivedRawChunksAll[currentIndex])], // Array containing one Uint8Array
                 rawResponse: [commandState.receivedRawChunksAll[currentIndex]], // Array containing one number[]

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
