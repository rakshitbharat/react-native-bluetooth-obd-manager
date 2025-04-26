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
function createDeferredPromise<T>(): DeferredPromise<T> {
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
): Promise<string | Uint8Array | ChunkedResponse> => {
  if (isAwaitingResponse) {
    throw new Error('Another command is already in progress.');
  }

  // Clear existing command with proper cleanup
  if (currentCommandRef.current) {
    log.warn('[commandExecutor] Stale command ref found - clearing.');
    if (currentCommandRef.current.promise) {
      currentCommandRef.current.promise.reject(
        new Error('Command cancelled due to new command starting.'),
      );
    }
    dispatch({
      type: 'COMMAND_FAILURE',
      payload: new Error('Command cancelled due to new command starting.'),
    });
    currentCommandRef.current = null;
  }

  const deviceId = connectedDevice.id;

  const deferredPromise = createDeferredPromise<InternalCommandResponse>();

  currentCommandRef.current = {
    promise: deferredPromise,
    receivedRawChunks: [], // Keep original initialization for now
    receivedRawChunksAll: [[]], // Initialize new array with one empty response array
    currentResponseIndex: 0, // Start index for receivedRawChunksAll
    expectedReturnType: returnType,
  };

  dispatch({ type: 'SEND_COMMAND_START' });

  try {
    const commandString = command + ELM327_COMMAND_TERMINATOR;
    const commandBytes = Array.from(stringToBytes(commandString));

    log.info(
      `[commandExecutor] Writing command "${command}" using ${activeDeviceConfig.writeType}...`,
    );
    if (activeDeviceConfig.writeType === 'Write') {
      await BleManager.write(
        deviceId,
        activeDeviceConfig.serviceUUID,
        activeDeviceConfig.writeCharacteristicUUID,
        commandBytes,
      );
    } else {
      await BleManager.writeWithoutResponse(
        deviceId,
        activeDeviceConfig.serviceUUID,
        activeDeviceConfig.writeCharacteristicUUID,
        commandBytes,
      );
    }

    log.info(
      `[commandExecutor] Command "${command}" written. Waiting for internal response promise...`,
    );

    // --- Promise resolution logic needs adjustment later ---
    // This part will need to change based on how we decide a command is fully complete
    // when multiple responses might be involved.
    const internalResponse = await deferredPromise.promise;

    // Command succeeded
    log.info(
      `[commandExecutor] Internal response received for command "${command}". Processing based on returnType: ${returnType}`,
    );
    dispatch({ type: 'COMMAND_SUCCESS' }); // Dispatch success
    currentCommandRef.current = null; // Clear the ref on success

    // --- Response processing needs adjustment later ---
    // This needs to handle the receivedRawChunks[responseIndex] structure
    switch (returnType) {
      case ReturnTypeEnum.STRING:
        // TODO: Adjust to process receivedRawChunks[?] based on completion logic
        return chunksToString({ chunks: internalResponse.chunks });
      case ReturnTypeEnum.BYTES:
        // TODO: Adjust to process receivedRawChunks[?] based on completion logic
        return concatenateChunks({ chunks: internalResponse.chunks });
      case ReturnTypeEnum.CHUNKED: {
        // TODO: Adjust to process receivedRawChunks[?] based on completion logic
        const chunkedResult: ChunkedResponse = {
          chunks: internalResponse.chunks,
          rawResponse: internalResponse.rawResponse,
        };
        return chunkedResult;
      }
      default:
        log.error(
          `[commandExecutor] Unsupported return type encountered: ${returnType}`,
        );
        throw new Error(`Unsupported return type: ${returnType}`);
    }
  } catch (error) {
    const formattedError = handleError(error);
    log.error(
      `[commandExecutor] Command "${command}" execution failed:`,
      formattedError,
    );

    if (currentCommandRef.current?.promise === deferredPromise) {
      currentCommandRef.current = null;
      dispatch({ type: 'COMMAND_FAILURE', payload: formattedError });
    } else {
      log.warn(
        `[commandExecutor] Error caught for command "${command}", but it's no longer the active command. Ignoring cleanup for this specific error instance.`,
      );
    }
    throw formattedError;
  }
};
