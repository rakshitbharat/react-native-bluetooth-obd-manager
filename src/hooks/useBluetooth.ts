import {
  isChunkedResponse,
  concatenateChunks,
  chunksToString,
  getShortUUID, // Import the new helper
} from '../utils/byteUtils';
import {
  executeCommandInternal,
  createDeferredPromise,
} from '../utils/commandExecutor'; // Import executeCommandInternal and createDeferredPromise
import type { ChunkedResponse, BleError as BleErrorType } from '../types'; // Import necessary types, rename BleError to avoid conflict
import { log } from '../utils/logger'; // Import logger
import {
  useBluetoothState,
  useBluetoothDispatch,
} from '../context/BluetoothContext'; // Import context hooks
import { useInternalCommandControl } from '../context/BluetoothProvider'; // Import internal hook
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import BleManager, {
  type Peripheral,
  // Remove BleError import from here
} from 'react-native-ble-manager';
// Import PERMISSIONS constants
import Permissions, {
  PERMISSIONS, // Import the constants object
  type Permission,
  type PermissionStatus,
} from 'react-native-permissions';
import type {
  UseBluetoothResult,
  DeferredPromise,
  ActiveDeviceConfig,
} from '../types'; // Import necessary types
// Import CommandReturnType from constants
import { KNOWN_ELM327_TARGETS, CommandReturnType } from '../constants'; // Import constants

// Define a default timeout duration in milliseconds
const DEFAULT_COMMAND_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Custom hook for managing Bluetooth connections with ELM327 OBD-II adapters.
 *
 * Provides a complete interface for:
 * - Checking and requesting Bluetooth permissions
 * - Scanning for nearby Bluetooth devices
 * - Connecting to ELM327-compatible OBD-II adapters
 * - Sending commands and receiving responses
 * - Managing connection state
 *
 * @returns {UseBluetoothResult} Object containing Bluetooth state and control functions
 * @example
 * ```tsx
 * const {
 *   isBluetoothOn,
 *   discoveredDevices,
 *   connectedDevice,
 *   scanDevices,
 *   connectToDevice,
 *   sendCommand,
 * } = useBluetooth();
 *
 * // Check if Bluetooth is enabled
 * if (!isBluetoothOn) {
 *   // Show a message or prompt the user to enable Bluetooth
 * }
 *
 * // Start scanning for devices
 * const handleScan = async () => {
 *   try {
 *     await scanDevices(5000); // Scan for 5 seconds
 *     // Devices will be in discoveredDevices array
 *   } catch (error) {
 *     log.error('Scan failed:', error);
 *   }
 * };
 * ```
 */
export const useBluetooth = (): UseBluetoothResult => {
  const state = useBluetoothState();
  const dispatch = useBluetoothDispatch();
  const { currentCommandRef } = useInternalCommandControl();

  // Refs to manage promises for ongoing async operations initiated by the hook
  const scanPromiseRef = useRef<DeferredPromise<void> | null>(null);
  const connectPromiseRef = useRef<DeferredPromise<Peripheral> | null>(null);
  const disconnectPromiseRef = useRef<DeferredPromise<void> | null>(null);

  // Re-add handleStateError as it's used in multiple places within this hook
  const handleStateError = (error: BleErrorType | Error | null): Error => {
    if (!error) {
      return new Error('An unknown error occurred');
    }
    if (error instanceof Error) {
      return error;
    }
    // Handle BleError type specifically if needed, otherwise treat as generic object
    if (
      typeof error === 'object' &&
      error !== null &&
      'errorCode' in error && // Check for BleError properties
      'message' in error
    ) {
      return new Error(
        `BLE Error (${(error as BleErrorType).errorCode}): ${(error as BleErrorType).message}`,
      );
    }
    // Fallback for other types
    return new Error(String(error));
  };

  // --- Permission Functions ---

  /**
   * Checks if required Bluetooth permissions are granted.
   *
   * On Android 12+ (API 31+), checks BLUETOOTH_SCAN, BLUETOOTH_CONNECT, and ACCESS_FINE_LOCATION.
   * On older Android versions, checks ACCESS_FINE_LOCATION.
   * On iOS, checks LOCATION_WHEN_IN_USE.
   *
   * @returns {Promise<boolean>} True if all required permissions are granted, false otherwise
   */
  const checkPermissions = useCallback(async (): Promise<boolean> => {
    log.info('[useBluetooth] Checking permissions...');
    let requiredPermissions: Permission[] = []; // Use Permission type directly
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        requiredPermissions = [
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN, // Use PERMISSIONS constant
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT, // Use PERMISSIONS constant
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION, // Use PERMISSIONS constant
        ];
      } else {
        requiredPermissions = [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]; // Use PERMISSIONS constant
      }
    } else if (Platform.OS === 'ios') {
      // iOS permissions are typically handled via Info.plist entries
      // (NSBluetoothAlwaysUsageDescription, NSLocationWhenInUseUsageDescription)
      // Check might implicitly succeed if entries exist, but we can check location
      requiredPermissions = [PERMISSIONS.IOS.LOCATION_WHEN_IN_USE]; // Use PERMISSIONS constant
    }

    if (requiredPermissions.length === 0) {
      log.info(
        '[useBluetooth] No specific permissions require checking on this platform/OS version.',
      );
      dispatch({ type: 'SET_PERMISSIONS_STATUS', payload: true });
      return true;
    }

    try {
      const statuses = await Permissions.checkMultiple(requiredPermissions);
      const allGranted = requiredPermissions.every(
        permission => statuses[permission] === Permissions.RESULTS.GRANTED,
      );
      log.info(
        `[useBluetooth] Permission check result: ${allGranted}`,
        statuses,
      );
      dispatch({ type: 'SET_PERMISSIONS_STATUS', payload: allGranted });
      return allGranted;
    } catch (error) {
      // Fix: Ensure error is handled before passing
      const formattedError = handleStateError(
        error as Error | BleErrorType | null,
      ); // Use BleErrorType
      log.error('[useBluetooth] Permission check failed:', formattedError);
      dispatch({ type: 'SET_PERMISSIONS_STATUS', payload: false });
      dispatch({ type: 'SET_ERROR', payload: formattedError });
      return false;
    }
  }, [dispatch]);

  /**
   * Requests required Bluetooth permissions from the user.
   *
   * On Android 12+, requests BLUETOOTH_SCAN, BLUETOOTH_CONNECT, and ACCESS_FINE_LOCATION.
   * On older Android versions, requests ACCESS_FINE_LOCATION.
   * On iOS, requests LOCATION_WHEN_IN_USE and BLUETOOTH.
   *
   * @returns {Promise<boolean>} True if all required permissions are granted, false otherwise
   */
  const requestBluetoothPermissions =
    useCallback(async (): Promise<boolean> => {
      log.info('[useBluetooth] Requesting permissions...');
      let permissionsToRequest: Permission[] = []; // Use Permission type directly
      const iosBlePermissionNeeded = false;

      if (Platform.OS === 'android') {
        if (Platform.Version >= 31) {
          permissionsToRequest = [
            PERMISSIONS.ANDROID.BLUETOOTH_SCAN, // Use PERMISSIONS constant
            PERMISSIONS.ANDROID.BLUETOOTH_CONNECT, // Use PERMISSIONS constant
            PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION, // Use PERMISSIONS constant
          ];
        } else {
          permissionsToRequest = [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]; // Use PERMISSIONS constant
        }
      } else if (Platform.OS === 'ios') {
        permissionsToRequest = [
          PERMISSIONS.IOS.LOCATION_WHEN_IN_USE, // Use PERMISSIONS constant
        ];
        // Note: iOS Bluetooth permission is often implicitly handled by CoreBluetooth
        // or requested automatically on first use. Explicit request might not be needed
        // depending on react-native-permissions version and iOS behavior.
        // We'll keep the structure but log if no explicit request is made.
        // iosBlePermissionNeeded = true; // Re-evaluate if needed based on testing
      }

      if (permissionsToRequest.length === 0 && !iosBlePermissionNeeded) {
        log.info(
          '[useBluetooth] No specific permissions require requesting on this platform.',
        );
        dispatch({ type: 'SET_PERMISSIONS_STATUS', payload: true });
        return true;
      }

      try {
        let allGranted = true;
        let finalStatuses: Record<string, PermissionStatus> = {};

        // Request standard permissions first
        if (permissionsToRequest.length > 0) {
          const statuses =
            await Permissions.requestMultiple(permissionsToRequest);
          finalStatuses = { ...statuses };
          allGranted = permissionsToRequest.every(
            permission => statuses[permission] === Permissions.RESULTS.GRANTED,
          );
        }

        // Request iOS Bluetooth separately if needed (currently disabled, see note above)
        const iosBluetoothGranted = true;
        // if (Platform.OS === 'ios' && iosBlePermissionNeeded) {
        //   // Example: const bleStatus = await Permissions.request(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);
        //   // iosBluetoothGranted = bleStatus === Permissions.RESULTS.GRANTED;
        //   // finalStatuses[PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL] = bleStatus;
        //   log.warn('[useBluetooth] iOS Bluetooth permission request logic needs review/implementation if required.');
        // }

        const finalGranted = allGranted && iosBluetoothGranted;

        log.info(
          `[useBluetooth] Overall permission request result: ${finalGranted}`,
          finalStatuses,
        );
        dispatch({ type: 'SET_PERMISSIONS_STATUS', payload: finalGranted });

        if (!finalGranted) {
          log.warn('[useBluetooth] Not all required permissions were granted.');
          // Optionally dispatch an error or specific state update
        }

        return finalGranted;
      } catch (error) {
        // Fix: Ensure error is handled before passing
        const formattedError = handleStateError(
          error as Error | BleErrorType | null, // Use BleErrorType
        );
        log.error('[useBluetooth] Permission request failed:', formattedError);
        dispatch({ type: 'SET_PERMISSIONS_STATUS', payload: false });
        dispatch({ type: 'SET_ERROR', payload: formattedError });
        return false;
      }
    }, [dispatch]);

  /**
   * Prompts the user to enable Bluetooth if it's disabled.
   *
   * On Android, this shows the system dialog to enable Bluetooth.
   * On iOS, this does nothing as there's no programmatic way to show the Bluetooth settings.
   *
   * @returns {Promise<void>} Resolves when Bluetooth is enabled or rejects if user denies
   * @throws {Error} If the user denies the request or there's another error
   */
  const promptEnableBluetooth = useCallback(async (): Promise<void> => {
    if (state.isBluetoothOn) {
      log.info('[useBluetooth] Bluetooth is already enabled.');
      return;
    }

    if (Platform.OS === 'android') {
      try {
        log.info(
          '[useBluetooth] Prompting user to enable Bluetooth (Android)...',
        );
        await BleManager.enableBluetooth();
        log.info('[useBluetooth] Bluetooth enabled by user.');
        // State update will happen via BleManagerDidUpdateState listener
      } catch (error) {
        const formattedError = handleStateError(
          error as Error | BleErrorType | null,
        ); // Use BleErrorType
        log.error('[useBluetooth] Failed to enable Bluetooth:', formattedError);
        dispatch({ type: 'SET_ERROR', payload: formattedError });
        throw formattedError; // Re-throw for the caller
      }
    } else if (Platform.OS === 'ios') {
      log.warn(
        '[useBluetooth] Cannot programmatically prompt to enable Bluetooth on iOS. Please guide the user to Settings.',
      );
      // Optionally throw an error or resolve depending on desired behavior
      // throw new Error('Enable Bluetooth via Settings on iOS.');
    }
  }, [state.isBluetoothOn, dispatch]); // Add dispatch dependency

  /**
   * Scans for nearby Bluetooth devices.
   *
   * This will update the `discoveredDevices` state with found devices.
   * Each device is tagged with `isLikelyOBD` based on name heuristics.
   *
   * @param {number} [scanDurationMs=5000] How long to scan in milliseconds
   * @returns {Promise<void>} Resolves when scanning completes
   * @throws {Error} If Bluetooth is off, permissions are missing, or scan fails
   */
  const scanDevices = useCallback(
    async (scanDurationMs = 5000): Promise<void> => {
      if (!state.isBluetoothOn) {
        const error = new Error('Bluetooth is not enabled.');
        dispatch({ type: 'SET_ERROR', payload: error });
        throw error;
      }
      if (!state.hasPermissions) {
        const error = new Error('Required Bluetooth permissions are missing.');
        dispatch({ type: 'SET_ERROR', payload: error });
        throw error;
      }
      if (state.isScanning) {
        log.warn('[useBluetooth] Scan already in progress.');
        return; // Or throw an error if preferred
      }

      log.info(`[useBluetooth] Starting BLE scan for ${scanDurationMs}ms...`);
      dispatch({ type: 'SCAN_START' });

      // Create a deferred promise that the Provider's listener can resolve/reject
      scanPromiseRef.current = {
        promise: null as unknown as Promise<void>, // Will be replaced
        resolve: () => {},
        reject: () => {},
      };
      const deferred = createDeferredPromise<void>();
      scanPromiseRef.current.promise = deferred.promise;
      scanPromiseRef.current.resolve = deferred.resolve;
      scanPromiseRef.current.reject = deferred.reject;

      try {
        // Clear previous devices before starting a new scan
        dispatch({ type: 'CLEAR_DISCOVERED_DEVICES' });

        // Start the scan with BleManager
        // Note: Service UUID filtering might be too restrictive for initial discovery
        await BleManager.scan([], scanDurationMs, true); // Scan for all devices

        log.info('[useBluetooth] Scan initiated. Waiting for completion...');

        // Wait for the promise that will be resolved/rejected by the BleManagerStopScan listener
        await scanPromiseRef.current.promise;
        log.info('[useBluetooth] Scan completed successfully.');
      } catch (error) {
        const formattedError = handleStateError(
          error as Error | BleErrorType | null,
        ); // Use BleErrorType
        log.error('[useBluetooth] Scan failed:', formattedError);
        dispatch({ type: 'SCAN_STOP' }); // Ensure scan state is reset
        dispatch({ type: 'SET_ERROR', payload: formattedError });
        scanPromiseRef.current?.reject(formattedError); // Reject the promise on error
        throw formattedError; // Re-throw for the caller
      } finally {
        scanPromiseRef.current = null; // Clean up ref
      }
    },
    [state.isBluetoothOn, state.hasPermissions, state.isScanning, dispatch],
  );

  /**
   * Connects to a Bluetooth device and configures it for ELM327 communication.
   *
   * This function:
   * 1. Connects to the specified peripheral
   * 2. Retrieves services and characteristics
   * 3. Finds a compatible ELM327 service/characteristic configuration (handles short/full UUIDs)
   * 4. Starts notifications on the appropriate characteristic
   *
   * @param {string} deviceId The ID of the device to connect to
   * @returns {Promise<Peripheral>} The connected peripheral object
   * @throws {Error} If already connecting, already connected to another device,
   *                 or if the device is incompatible or connection fails
   */
  const connectToDevice = useCallback(
    async (deviceId: string): Promise<Peripheral> => {
      if (state.isConnecting) {
        throw new Error('Connection already in progress.');
      }
      if (state.connectedDevice && state.connectedDevice.id !== deviceId) {
        throw new Error(
          `Already connected to a different device (${state.connectedDevice.id}). Disconnect first.`,
        );
      }
      if (state.connectedDevice && state.connectedDevice.id === deviceId) {
        log.warn(`[useBluetooth] Already connected to ${deviceId}.`);
        return state.connectedDevice; // Already connected to this device
      }

      log.info(`[useBluetooth] Attempting connection to ${deviceId}...`);
      dispatch({ type: 'CONNECT_START' });

      // Create deferred promise
      connectPromiseRef.current = {
        promise: null as unknown as Promise<Peripheral>, // Will be replaced
        resolve: () => {},
        reject: () => {},
      };
      const deferred = createDeferredPromise<Peripheral>();
      connectPromiseRef.current.promise = deferred.promise;
      connectPromiseRef.current.resolve = deferred.resolve;
      connectPromiseRef.current.reject = deferred.reject;

      try {
        // Stop scanning if active
        if (state.isScanning) {
          log.info('[useBluetooth] Stopping scan before connecting...');
          await BleManager.stopScan();
          dispatch({ type: 'SCAN_STOP' }); // Update state immediately
        }

        // Attempt connection
        await BleManager.connect(deviceId);
        log.info(
          `[useBluetooth] Connected to ${deviceId}. Retrieving services...`,
        );

        // Retrieve services and characteristics
        const peripheralInfo = await BleManager.retrieveServices(deviceId);
        log.debug(
          '[useBluetooth] Peripheral services retrieved:',
          peripheralInfo,
        );

        // Find compatible ELM327 service/characteristic configuration
        let foundConfig: ActiveDeviceConfig | null = null;
        for (const target of KNOWN_ELM327_TARGETS) {
          const serviceUUID = target.serviceUUID;
          const writeCharUUID = target.writeCharacteristicUUID;
          const notifyCharUUID = target.notifyCharacteristicUUID;

          const service = peripheralInfo.services?.find(
            s => getShortUUID(s.uuid) === getShortUUID(serviceUUID),
          );
          if (!service) continue;

          const writeChar = peripheralInfo.characteristics?.find(
            c =>
              getShortUUID(c.characteristic) === getShortUUID(writeCharUUID) &&
              getShortUUID(c.service) === getShortUUID(serviceUUID) &&
              (c.properties.Write || c.properties.WriteWithoutResponse),
          );
          const notifyChar = peripheralInfo.characteristics?.find(
            c =>
              getShortUUID(c.characteristic) === getShortUUID(notifyCharUUID) &&
              getShortUUID(c.service) === getShortUUID(serviceUUID) &&
              c.properties.Notify,
          );

          if (writeChar && notifyChar) {
            foundConfig = {
              serviceUUID: service.uuid, // Use full UUIDs
              writeCharacteristicUUID: writeChar.characteristic,
              notifyCharacteristicUUID: notifyChar.characteristic,
              writeType: writeChar.properties.WriteWithoutResponse
                ? 'WriteWithoutResponse'
                : 'Write',
            };
            log.info(
              `[useBluetooth] Found compatible ELM327 configuration:`,
              foundConfig,
            );
            break; // Found a working config
          }
        }

        if (!foundConfig) {
          throw new Error(
            `Device ${deviceId} does not support known ELM327 services/characteristics.`,
          );
        }

        // Start notifications
        log.info(
          `[useBluetooth] Starting notifications on ${foundConfig.notifyCharacteristicUUID}...`,
        );
        await BleManager.startNotification(
          deviceId,
          foundConfig.serviceUUID,
          foundConfig.notifyCharacteristicUUID,
        );
        log.info('[useBluetooth] Notifications started.');

        // Update state with connected device and config
        // Find the full peripheral object from discovered devices or use a minimal one
        const connectedPeripheral = state.discoveredDevices.find(
          d => d.id === deviceId,
        ) || {
          id: deviceId,
          name: peripheralInfo.name || 'Unknown Device', // Use name from retrieved info if available
          // Add other relevant fields if needed, e.g., rssi (might be stale)
        };

        dispatch({
          type: 'CONNECT_SUCCESS',
          payload: { device: connectedPeripheral, config: foundConfig },
        });

        connectPromiseRef.current?.resolve(connectedPeripheral); // Resolve the promise
        log.info(
          `[useBluetooth] Successfully connected and configured ${deviceId}.`,
        );
        return connectedPeripheral;
      } catch (error) {
        const formattedError = handleStateError(
          error as Error | BleErrorType | null,
        ); // Use BleErrorType
        log.error(
          `[useBluetooth] Connection to ${deviceId} failed:`,
          formattedError,
        );
        dispatch({ type: 'CONNECT_FAILURE', payload: formattedError });
        connectPromiseRef.current?.reject(formattedError); // Reject the promise

        // Attempt graceful disconnect if connection partially succeeded
        try {
          await BleManager.disconnect(deviceId);
          log.info(
            `[useBluetooth] Cleaned up partial connection to ${deviceId}.`,
          );
        } catch (disconnectError) {
          log.warn(
            `[useBluetooth] Error during cleanup disconnect for ${deviceId}:`,
            handleStateError(disconnectError as Error | BleErrorType | null), // Use BleErrorType
          );
        }

        throw formattedError; // Re-throw for the caller
      } finally {
        connectPromiseRef.current = null; // Clean up ref
      }
    },
    [
      state.isConnecting,
      state.connectedDevice,
      state.isScanning,
      state.discoveredDevices,
      dispatch,
    ], // Add discoveredDevices
  );

  // --- Disconnection Function ---

  const disconnect = useCallback(async (): Promise<void> => {
    if (state.isDisconnecting) {
      log.warn('[useBluetooth] Disconnection already in progress.');
      return; // Or throw error
    }
    if (!state.connectedDevice || !state.activeDeviceConfig) {
      log.warn('[useBluetooth] No device connected to disconnect.');
      return; // Nothing to do
    }

    const deviceId = state.connectedDevice.id;
    const config = state.activeDeviceConfig;
    log.info(`[useBluetooth] Disconnecting from ${deviceId}...`);
    dispatch({ type: 'DISCONNECT_START' });

    // Create deferred promise
    disconnectPromiseRef.current = {
      promise: null as unknown as Promise<void>, // Will be replaced
      resolve: () => {},
      reject: () => {},
    };
    const deferred = createDeferredPromise<void>();
    disconnectPromiseRef.current.promise = deferred.promise;
    disconnectPromiseRef.current.resolve = deferred.resolve;
    disconnectPromiseRef.current.reject = deferred.reject;

    try {
      // Stop notifications first (optional but good practice)
      try {
        log.info(
          `[useBluetooth] Stopping notifications on ${config.notifyCharacteristicUUID}...`,
        );
        await BleManager.stopNotification(
          deviceId,
          config.serviceUUID,
          config.notifyCharacteristicUUID,
        );
        log.info('[useBluetooth] Notifications stopped.');
      } catch (stopNotifyError) {
        log.warn(
          '[useBluetooth] Failed to stop notifications during disconnect (continuing):',
          handleStateError(stopNotifyError as Error | BleErrorType | null), // Use BleErrorType
        );
      }

      // Perform disconnection
      await BleManager.disconnect(deviceId);
      log.info(`[useBluetooth] Successfully disconnected from ${deviceId}.`);

      // State update will be triggered by the BleManagerDisconnectPeripheral listener
      // which calls dispatch({ type: 'DEVICE_DISCONNECTED' });
      disconnectPromiseRef.current?.resolve(); // Resolve the promise
    } catch (error) {
      const formattedError = handleStateError(
        error as Error | BleErrorType | null,
      ); // Use BleErrorType
      log.error(
        `[useBluetooth] Disconnect from ${deviceId} failed:`,
        formattedError,
      );
      dispatch({ type: 'DISCONNECT_FAILURE', payload: formattedError });
      disconnectPromiseRef.current?.reject(formattedError); // Reject the promise
      throw formattedError; // Re-throw for the caller
    } finally {
      // Ensure state is updated even if listener fails (belt and suspenders)
      if (state.connectedDevice?.id === deviceId) {
        dispatch({ type: 'DEVICE_DISCONNECTED' });
      }
      disconnectPromiseRef.current = null; // Clean up ref
    }
  }, [
    state.connectedDevice,
    state.activeDeviceConfig,
    state.isDisconnecting,
    dispatch,
  ]);

  // --- Command Functions ---

  // Helper function to add timeout to command execution
  const executeCommandWithTimeout = async <T>(
    commandPromise: Promise<T>,
    timeoutMs: number = DEFAULT_COMMAND_TIMEOUT_MS, // Keep default
  ): Promise<T> => {
    let timeoutId: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        log.warn(`[useBluetooth] Command timed out after ${timeoutMs}ms.`);
        // Reject the promise associated with the current command
        if (currentCommandRef.current?.promise) {
          const timeoutError = new Error(
            `Command timed out after ${timeoutMs}ms`,
          );
          currentCommandRef.current.promise.reject(timeoutError);
          // Optionally dispatch failure here as well, though executeCommandInternal might handle it
          dispatch({ type: 'COMMAND_FAILURE', payload: timeoutError });
          currentCommandRef.current = null; // Clear ref on timeout
        }
        // Also reject the race promise
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      // Race the actual command against the timeout
      return await Promise.race([commandPromise, timeoutPromise]);
    } finally {
      // Clear the timeout timer if the command completes or fails before the timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  // Replace the old executeCommand implementation with a wrapper calling the internal one
  const executeCommand = useCallback(
    async (
      command: string,
      returnType: CommandReturnType,
      options?: { timeout?: number }, // Add options parameter back
    ): Promise<string | Uint8Array | ChunkedResponse> => {
      if (!state.connectedDevice || !state.activeDeviceConfig) {
        throw new Error('Not connected to a device.');
      }
      // Call the separated execution logic from commandExecutor.ts
      // Wrap the internal call with the timeout helper
      // Use provided timeout or default
      const timeoutDuration = options?.timeout ?? DEFAULT_COMMAND_TIMEOUT_MS;
      return executeCommandWithTimeout(
        executeCommandInternal(
          command,
          returnType,
          // options, // No longer pass options down to internal
          state.connectedDevice, // Pass connected device
          state.activeDeviceConfig, // Pass active config
          state.isAwaitingResponse, // Pass awaiting state
          currentCommandRef, // Pass the ref
          dispatch, // Pass dispatch
        ),
        timeoutDuration, // Use the determined timeout duration
      );
    },
    [
      state.connectedDevice,
      state.activeDeviceConfig,
      state.isAwaitingResponse,
      dispatch,
      currentCommandRef,
    ],
  );

  const sendCommand = async (
    command: string,
    options?: { timeout?: number }, // Add options parameter
  ): Promise<string> => {
    // Calls the executeCommand wrapper above, passing options
    const result = await executeCommand(
      command,
      CommandReturnType.CHUNKED, // Request chunked internally
      options, // Pass options
    );

    if (!isChunkedResponse(result)) {
      // This check might be redundant if executeCommandInternal guarantees type, but safe to keep
      throw new Error(
        'Internal error: Expected chunked response from executeCommand',
      );
    }

    return chunksToString(result); // Process the chunked response
  };

  const sendCommandRaw = async (
    command: string,
    options?: { timeout?: number }, // Add options parameter
  ): Promise<Uint8Array> => {
    // Calls the executeCommand wrapper above, passing options
    const result = await executeCommand(
      command,
      CommandReturnType.CHUNKED, // Request chunked internally
      options, // Pass options
    );

    if (!isChunkedResponse(result)) {
      throw new Error(
        'Internal error: Expected chunked response from executeCommand',
      );
    }

    return concatenateChunks(result); // Process the chunked response
  };

  const sendCommandRawChunked = async (
    command: string,
    options?: { timeout?: number }, // Add options parameter
  ): Promise<ChunkedResponse> => {
    // Calls the executeCommand wrapper above, passing options
    const result = await executeCommand(
      command,
      CommandReturnType.CHUNKED, // Request chunked internally
      options, // Pass options
    );

    if (!isChunkedResponse(result)) {
      throw new Error(
        'Internal error: Expected chunked response from executeCommand',
      );
    }

    return result; // Return the chunked response directly
  };

  const setStreaming = useCallback(
    (shouldStream: boolean): void => {
      if (!state.connectedDevice && shouldStream) {
        log.warn(
          '[useBluetooth] Cannot enable streaming: No device connected.',
        );
        // Optionally throw an error or just return
        return;
      }

      // Only dispatch if the state is actually changing
      if (state.isStreaming !== shouldStream) {
        log.info(`[useBluetooth] Setting streaming mode to: ${shouldStream}`);
        // Correct the action type to SET_STREAMING_STATUS
        dispatch({ type: 'SET_STREAMING_STATUS', payload: shouldStream });
      } else {
        log.debug(
          `[useBluetooth] Streaming mode is already ${shouldStream}. No change needed.`,
        );
      }
    },
    [state.isStreaming, state.connectedDevice, dispatch],
  );

  // --- Effect to handle promise resolution/rejection based on state changes ---
  // This effect runs whenever relevant state flags change (e.g., isScanning, connectedDevice)
  // and checks if the corresponding promise ref should be resolved or rejected.
  useEffect(() => {
    // Scan Promise
    if (scanPromiseRef.current) {
      if (!state.isScanning && !state.error) {
        // Scan finished successfully (stopped without error)
        scanPromiseRef.current.resolve();
        scanPromiseRef.current = null; // Clean up
      } else if (!state.isScanning && state.error) {
        // Scan stopped due to an error - use handleStateError
        scanPromiseRef.current.reject(handleStateError(state.error));
        scanPromiseRef.current = null; // Clean up
      }
    }

    // Connect Promise
    if (connectPromiseRef.current) {
      if (state.connectedDevice && !state.isConnecting && !state.error) {
        // Connection successful
        connectPromiseRef.current.resolve(state.connectedDevice);
        connectPromiseRef.current = null; // Clean up
      } else if (!state.isConnecting && state.error && !state.connectedDevice) {
        // Connection failed - use handleStateError
        connectPromiseRef.current.reject(handleStateError(state.error));
        connectPromiseRef.current = null; // Clean up
      }
    }

    // Disconnect Promise
    if (disconnectPromiseRef.current) {
      if (!state.connectedDevice && !state.isDisconnecting && !state.error) {
        // Disconnection successful
        disconnectPromiseRef.current.resolve();
        disconnectPromiseRef.current = null; // Clean up
      } else if (
        !state.isDisconnecting &&
        state.error &&
        state.connectedDevice
      ) {
        // Disconnection failed (still connected?) - use handleStateError
        disconnectPromiseRef.current.reject(handleStateError(state.error));
        disconnectPromiseRef.current = null; // Clean up
      }
    }
  }, [
    state.isScanning,
    state.isConnecting,
    state.isDisconnecting,
    state.connectedDevice,
    state.error,
  ]); // Dependencies cover state changes

  // --- Effect to process incoming data for sendCommand ---
  // NOTE: The useEffect hook previously here for handling incoming data and decoding
  // has been removed. This logic is now centralized within the BluetoothProvider's
  // handleIncomingData function, which directly resolves the command promise.

  // Effect to append incoming data to buffer - NEEDS REVISION
  // This is problematic here, depends on how DATA_RECEIVED updates state or if
  // we pass data differently. Let's assume for now the Provider handles this.
  // useEffect(() => {
  //   // On DATA_RECEIVED action (how to detect this here?)
  //   // commandResponseBufferRef.current.push(...action.payload);
  // }, [/* dependency on received data */]);

  // Return the state values and the memoized functions
  return {
    ...state, // Spread all state properties

    // Action Functions
    checkPermissions,
    scanDevices,
    connectToDevice,
    disconnect,
    sendCommand, // Expose the simplified sendCommand
    sendCommandRaw, // Expose the simplified sendCommandRaw
    sendCommandRawChunked, // Expose the simplified sendCommandRawChunked

    // TODO Functions (return placeholders if still needed)
    requestBluetoothPermissions,
    promptEnableBluetooth,
    setStreaming,
    // Note: executeCommand is no longer directly exposed, use the specific sendCommand* variants
  };
};
