import BleManager, { type Peripheral } from 'react-native-ble-manager';
import type { Dispatch } from 'react';
import type {
  ActiveDeviceConfig,
  CommandExecutionState,
  InternalCommandResponse,
  ChunkedResponse,
  DeferredPromise,
  BleError,
  BluetoothAction, // Import BluetoothAction
} from '../types'; // Adjust path as needed
import {
  ELM327_COMMAND_TERMINATOR,
  CommandReturnType,
  CommandReturnType as ReturnTypeEnum,
} from '../constants'; // Adjust path as needed
import { stringToBytes } from './ecuUtils'; // Adjust path as needed
import { log } from './logger'; // Adjust path as needed
import { chunksToString, concatenateChunks } from './byteUtils'; // Adjust path as needed

// Helper to create Promises that can be resolved/rejected externally
// Export the function
export function createDeferredPromise<T>(): DeferredPromise<T> {
  let resolveFn!: (value: T | PromiseLike<T>) => void;
  let rejectFn!: (reason: Error) => void;

  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return { promise, resolve: resolveFn, reject: rejectFn };
}

// Update error handling to convert BleError to Error
const handleError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  // Handle BleError type
  if (
    typeof error === 'object' &&
    error !== null &&
    'errorCode' in error &&
    'message' in error
  ) {
    return new Error(
      `BLE Error (${(error as BleError).errorCode}): ${(error as BleError).message}`,
    );
  }
  return new Error(String(error));
};

/**
 * Executes a command on the connected Bluetooth device.
 * This function encapsulates the logic for sending a command, managing timeouts,
 * and handling the response promise lifecycle via the currentCommandRef.
 * On timeout, it resolves with any data collected so far.
 *
 * @internal - Intended for use by useBluetooth hook.
 */
export const executeCommandInternal = async (
  command: string,
  returnType: CommandReturnType,
  connectedDevice: Peripheral, // Assume connectedDevice is not null here
  activeDeviceConfig: ActiveDeviceConfig, // Assume activeDeviceConfig is not null here
  isAwaitingResponse: boolean,
  currentCommandRef: React.MutableRefObject<CommandExecutionState | null>,
  dispatch: Dispatch<BluetoothAction>, // Use specific type instead of any
  timeoutDuration: number, // Add timeout duration parameter
): Promise<string | Uint8Array | ChunkedResponse> => {
  if (isAwaitingResponse && currentCommandRef.current) {
    // If truly awaiting (SEND_COMMAND_START dispatched but no COMMAND_SUCCESS/FAILURE yet)
    // and the ref exists, throw the error.
    throw new Error('Another command is already in progress.');
  }

  // Create the deferred promise for this specific command execution
  const deferredPromise = createDeferredPromise<InternalCommandResponse>();
  const deviceId = connectedDevice.id; // Get deviceId from the parameter
  let timeoutId: NodeJS.Timeout | null = null; // Timeout ID

  // Clear existing command ref *state* or create a new one
  if (currentCommandRef.current) {
    log.warn(
      '[commandExecutor] Stale command ref found - updating promise and resetting index.',
    );
    // Reject the previous promise if it exists and hasn't been resolved/rejected
    if (currentCommandRef.current.promise) {
      // Check if the promise is still pending before rejecting
      // (This check is conceptual; promises don't have a standard 'isPending' state)
      // We rely on the fact that if it's still the active ref's promise, it's likely pending.
      currentCommandRef.current.promise.reject(
        new Error('Command cancelled due to new command starting.'),
      );
    }

    // Update the existing ref: Replace promise, reset index, set new return type.
    // Crucially, DO NOT touch receivedRawChunksAll here.
    currentCommandRef.current.promise = deferredPromise;
    currentCommandRef.current.currentResponseIndex = 0; // Reset index for the new command
    currentCommandRef.current.expectedReturnType = returnType;
  } else {
    // If no command ref exists, create the full state object
    currentCommandRef.current = {
      promise: deferredPromise,
      // Initialize receivedRawChunksAll ONLY if the ref was initially null
      receivedRawChunksAll: [[]], // Start with one empty response array
      currentResponseIndex: 0,
      expectedReturnType: returnType,
    };
  }

  // Keep a reference to the promise associated with *this* execution
  const thisExecutionPromise = currentCommandRef.current.promise;

  // Dispatch START *after* setting up the ref
  dispatch({ type: 'SEND_COMMAND_START' });

  try {
    const commandString = command + ELM327_COMMAND_TERMINATOR;
    const commandBytes = Array.from(stringToBytes(commandString));

    log.info(
      `[commandExecutor] Writing command "${command}" to ${deviceId} using ${activeDeviceConfig.writeType}...`,
    );
    if (activeDeviceConfig.writeType === 'Write') {
      await BleManager.write(
        deviceId, // Use variable
        activeDeviceConfig.serviceUUID,
        activeDeviceConfig.writeCharacteristicUUID,
        commandBytes,
      );
    } else {
      await BleManager.writeWithoutResponse(
        deviceId, // Use variable
        activeDeviceConfig.serviceUUID,
        activeDeviceConfig.writeCharacteristicUUID,
        commandBytes,
      );
    }

    log.info(
      `[commandExecutor] Command "${command}" written. Waiting for internal response promise (timeout: ${timeoutDuration}ms)...`,
    );

    // Start timeout timer
    timeoutId = setTimeout(() => {
      timeoutId = null; // Clear the stored ID
      // Check if the command associated with this timeout is still the active one
      if (currentCommandRef.current?.promise === thisExecutionPromise) {
        log.warn(
          `[commandExecutor] Command "${command}" timed out after ${timeoutDuration}ms. Resolving with collected data.`,
        );

        // Get whatever raw numbers were received before timeout
        const collectedRawNumbers: number[] =
          currentCommandRef.current.receivedRawChunksAll[
            currentCommandRef.current.currentResponseIndex
          ] ?? []; // Default to empty array if undefined

        // Construct a partial response matching InternalCommandResponse type
        const partialResponse: InternalCommandResponse = {
          // Convert the collected numbers to a Uint8Array and wrap in an array
          chunks: [Uint8Array.from(collectedRawNumbers)],
          // Wrap the collected numbers in an array to match number[][]
          rawResponse: [collectedRawNumbers],
        };

        // Resolve the promise with the partial data
        thisExecutionPromise.resolve(partialResponse);
        // Note: We don't dispatch COMMAND_FAILURE here. The resolution will
        // trigger the success path below, which dispatches COMMAND_SUCCESS.
        // We also don't clear the ref here; the success path will handle it.
      } else {
        log.warn(
          `[commandExecutor] Timeout fired for command "${command}", but a newer command is active or it already completed. Ignoring timeout resolution.`,
        );
      }
    }, timeoutDuration);

    // Wait for the promise associated *with this specific execution*
    // This promise might be resolved by incoming data OR by the timeout handler above
    const internalResponse = await thisExecutionPromise.promise;

    // If the timeout was active, clear it now that the promise is resolved
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Command completed (either fully or via timeout resolution)
    log.info(
      `[commandExecutor] Internal response promise resolved for command "${command}". Processing based on returnType: ${returnType}`,
      internalResponse, // Log the response (could be partial on timeout)
    );

    // Check if the current ref still points to *this* command's promise before clearing
    if (currentCommandRef.current?.promise === thisExecutionPromise) {
      dispatch({ type: 'COMMAND_SUCCESS' }); // Dispatch success (even on timeout resolution)
      currentCommandRef.current = null; // Clear the ref on completion
    } else {
      log.warn(
        `[commandExecutor] Command "${command}" completed, but a newer command has already started. Not clearing ref or dispatching success for this instance.`,
      );
      // Do not clear the ref or dispatch success, as it belongs to the newer command now.
    }

    // Process the response based on the resolved internalResponse
    switch (returnType) {
      case ReturnTypeEnum.STRING:
        // Use the chunks from the resolved promise
        return chunksToString({ chunks: internalResponse.chunks });
      case ReturnTypeEnum.BYTES:
        // Use the chunks from the resolved promise
        return concatenateChunks({ chunks: internalResponse.chunks });
      case ReturnTypeEnum.CHUNKED: {
        // Add braces to scope the declaration
        // Use both chunks and rawResponse from the resolved promise
        const chunkedResult: ChunkedResponse = {
          chunks: internalResponse.chunks,
          rawResponse: internalResponse.rawResponse,
        };
        return chunkedResult;
      }
      default: {
        // Add braces for consistency and future-proofing
        // This case should ideally be unreachable if types are correct
        const exhaustiveCheck: never = returnType;
        log.error(
          `[commandExecutor] Unsupported return type encountered: ${exhaustiveCheck}`,
        );
        throw new Error(`Unsupported return type: ${exhaustiveCheck}`);
      }
    }
  } catch (error) {
    // If the timeout was active when an error occurred, clear it
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const formattedError = handleError(error);
    log.error(
      `[commandExecutor] Command "${command}" execution failed:`,
      formattedError,
    );

    // Check if the error belongs to the currently active command in the ref
    if (currentCommandRef.current?.promise === thisExecutionPromise) {
      // Reject the promise explicitly ONLY if it hasn't been resolved by timeout already
      // (This check is slightly conceptual as promises don't have a standard isPending state,
      // but the logic flow ensures rejection happens only on actual errors before resolution)
      thisExecutionPromise.reject(formattedError); // Ensure the specific promise is rejected

      dispatch({ type: 'COMMAND_FAILURE', payload: formattedError });
      currentCommandRef.current = null; // Clear ref on failure of the active command
    } else {
      log.warn(
        `[commandExecutor] Error caught for command "${command}", but it's no longer the active command or may have timed out. Ignoring cleanup/dispatch for this specific error instance.`,
      );
      // Do not clear the ref or dispatch failure, as it belongs to the newer command now.
    }
    // Always re-throw the error so the caller catches it
    throw formattedError;
  }
};
