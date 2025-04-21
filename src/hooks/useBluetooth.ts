// src/hooks/useBluetooth.ts

import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import BleManager, { type Peripheral } from 'react-native-ble-manager';
import * as Permissions from 'react-native-permissions';
import type { PermissionStatus } from 'react-native-permissions';
import type { BleError, ChunkedResponse } from '../types';
// Import converter if needed for specific byte manipulations, TextDecoder is often built-in now
// import { stringToBytes } from 'convert-string'; // Example if needed
// TextDecoder/TextEncoder are generally globally available in modern RN environments

import {
  useBluetoothDispatch,
  useBluetoothState,
} from '../context/BluetoothContext';
import { useInternalCommandControl } from '../context/BluetoothProvider';
import {
  KNOWN_ELM327_TARGETS,
  DEFAULT_COMMAND_TIMEOUT,
  ELM327_COMMAND_TERMINATOR,
  ELM327_PROMPT_BYTE,
  CommandReturnType,
} from '../constants';
import type {
  ActiveDeviceConfig,
  UseBluetoothResult,
  DeferredPromise,
} from '../types';

// Helper to create Promises that can be resolved/rejected externally
// This is crucial for managing async operations triggered by BLE events
function createDeferredPromise<T>(): DeferredPromise<T> {
  let resolveFn!: (value: T | PromiseLike<T>) => void;
  let rejectFn!: (reason: Error) => void;

  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve; // This automatically has the correct type
    rejectFn = reject; // This automatically has the correct type
  });

  return { promise, resolve: resolveFn, reject: rejectFn };
}

// Helper function to extract short UUID (e.g., "FFF0") from standard Base UUID
function getShortUUID(fullUUID: string): string | null {
  const baseUUIDSuffix = '-0000-1000-8000-00805F9B34FB';
  const upperFullUUID = fullUUID.toUpperCase();
  // Check if it's a standard 16-bit or 32-bit UUID based on the common suffix
  if (
    upperFullUUID.startsWith('0000') &&
    upperFullUUID.endsWith(baseUUIDSuffix)
  ) {
    return upperFullUUID.substring(4, 8); // Extract the XXXX part
  }
  // Add check for non-standard but common patterns if needed, e.g. VLinker
  // else if ( specific check for other patterns ) { ... }
  return null; // Not a standard short UUID pattern we recognize
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

// Fix error handling for null cases
const handleStateError = (error: BleError | Error | null): Error => {
  if (!error) {
    return new Error('An unknown error occurred');
  }
  return handleError(error);
};

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
 *     console.error('Scan failed:', error);
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
    console.info('[useBluetooth] Checking permissions...');
    let requiredPermissions: Permissions.Permission[] = [];
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        // Android 12+
        requiredPermissions = [
          Permissions.PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          Permissions.PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          Permissions.PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION, // Still recommended for reliable scanning
        ];
      } else {
        // Android 11 and below
        requiredPermissions = [
          Permissions.PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION, // Required for BLE scanning
        ];
      }
    } else if (Platform.OS === 'ios') {
      // iOS permissions are typically handled via Info.plist entries
      // (NSBluetoothAlwaysUsageDescription, NSLocationWhenInUseUsageDescription)
      // Check might implicitly succeed if entries exist, but we can check location
      requiredPermissions = [Permissions.PERMISSIONS.IOS.LOCATION_WHEN_IN_USE];
    }

    if (requiredPermissions.length === 0) {
      console.info(
        '[useBluetooth] No specific permissions require checking on this platform/OS version.',
      );
      dispatch({ type: 'SET_PERMISSIONS_STATUS', payload: true }); // Assume true if none needed
      return true;
    }

    try {
      const statuses = await Permissions.checkMultiple(requiredPermissions);
      const allGranted = requiredPermissions.every(
        permission => statuses[permission] === Permissions.RESULTS.GRANTED,
      );
      console.info(
        `[useBluetooth] Permission check result: ${allGranted}`,
        statuses,
      );
      dispatch({ type: 'SET_PERMISSIONS_STATUS', payload: allGranted });
      return allGranted;
    } catch (error) {
      const formattedError = handleError(error);
      console.error('[useBluetooth] Permission check failed:', formattedError);
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
      console.info('[useBluetooth] Requesting permissions...');
      let permissionsToRequest: Permissions.Permission[] = [];
      let iosBlePermissionNeeded = false;

      if (Platform.OS === 'android') {
        if (Platform.Version >= 31) {
          // Android 12+
          permissionsToRequest = [
            Permissions.PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
            Permissions.PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
            Permissions.PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
          ];
        } else {
          // Android 11 and below
          permissionsToRequest = [
            Permissions.PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
          ];
        }
      } else if (Platform.OS === 'ios') {
        permissionsToRequest = [
          Permissions.PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
        ];
        iosBlePermissionNeeded = true;
      }

      if (permissionsToRequest.length === 0 && !iosBlePermissionNeeded) {
        console.info(
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
          console.info(
            '[useBluetooth] Standard permission request results:',
            statuses,
          );
        }

        // Request iOS Bluetooth separately if needed
        let iosBluetoothGranted = true;
        if (Platform.OS === 'ios' && iosBlePermissionNeeded) {
          console.info('[useBluetooth] Requesting iOS Bluetooth permission...');
          // Use BLUETOOTH for iOS permission
          const blePermission = Permissions.PERMISSIONS.IOS.BLUETOOTH;
          const bleStatus = await Permissions.request(blePermission);
          finalStatuses[blePermission] = bleStatus; // Use the variable
          iosBluetoothGranted =
            bleStatus === Permissions.RESULTS.GRANTED ||
            bleStatus === Permissions.RESULTS.UNAVAILABLE;
          console.info(
            `[useBluetooth] iOS Bluetooth request result: ${bleStatus}`,
          );
        }

        const finalGranted = allGranted && iosBluetoothGranted;

        console.info(
          `[useBluetooth] Overall permission request result: ${finalGranted}`,
          finalStatuses,
        );
        dispatch({ type: 'SET_PERMISSIONS_STATUS', payload: finalGranted });

        if (!finalGranted) {
          console.warn(
            '[useBluetooth] Not all required permissions were granted.',
          );
          const blocked = Object.values(finalStatuses).some(
            status => status === Permissions.RESULTS.BLOCKED,
          );
          if (blocked) {
            console.error(
              '[useBluetooth] One or more permissions are blocked. User must enable them in Settings.',
            );
          }
        }

        return finalGranted;
      } catch (error) {
        const formattedError = handleError(error);
        console.error(
          '[useBluetooth] Permission request failed:',
          formattedError,
        );
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
      console.info('[useBluetooth] Bluetooth is already enabled.');
      return; // No need to prompt if already on
    }

    if (Platform.OS === 'android') {
      try {
        console.info(
          '[useBluetooth] Requesting user to enable Bluetooth via native prompt...',
        );
        // This typically shows a system dialog on Android
        await BleManager.enableBluetooth();
        console.info(
          '[useBluetooth] Bluetooth enable request prompt shown (or Bluetooth enabled).',
        );
        // The actual state change (isBluetoothOn = true) will be triggered
        // by the BleManagerDidUpdateState listener if the user accepts.
      } catch (error) {
        const formattedError = handleError(error);
        console.error(
          '[useBluetooth] Failed to request Bluetooth enable (e.g., user denied):',
          formattedError,
        );
        throw new Error(
          `Failed to enable Bluetooth: ${formattedError.message}`,
        );
      }
    } else if (Platform.OS === 'ios') {
      // On iOS, there's no programmatic way to trigger the enable prompt.
      console.warn(
        '[useBluetooth] promptEnableBluetooth() has no effect on iOS. Guide user to Settings/Control Center.',
      );
      return Promise.resolve();
    }
  }, [state.isBluetoothOn]);

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
        throw new Error('Bluetooth is currently turned off.');
      }
      if (!state.hasPermissions) {
        throw new Error(
          'Required Bluetooth/Location permissions are not granted.',
        );
      }
      if (state.isScanning) {
        console.warn('[useBluetooth] Scan already in progress.');
        // Option 1: Throw error
        // throw new Error('Scan already in progress.');
        // Option 2: Return existing promise (if available) or just return
        return scanPromiseRef.current?.promise ?? Promise.resolve();
      }

      console.info(
        `[useBluetooth] Starting BLE scan for ${scanDurationMs}ms...`,
      );
      dispatch({ type: 'SCAN_START' });

      // Create a deferred promise that the Provider's listener can resolve/reject
      scanPromiseRef.current = createDeferredPromise<void>();

      try {
        const scanSeconds = Math.max(1, Math.round(scanDurationMs / 1000));
        const timeoutId = setTimeout(async () => {
          if (state.isScanning) {
            console.warn('[useBluetooth] Scan timed out.');
            try {
              // Force stop scan if timeout occurs
              await BleManager.stopScan();
            } catch (stopError) {
              console.error(
                '[useBluetooth] Error stopping scan on timeout:',
                stopError,
              );
            }
            // Provider will handle state update via BleManagerStopScan event
          }
        }, scanDurationMs + 1000); // Add 1s buffer

        // Start scan
        await BleManager.scan([], scanSeconds, false);
        console.info('[useBluetooth] BleManager.scan initiated.');

        // Wait for completion (resolved by BleManagerStopScan event in Provider)
        await scanPromiseRef.current.promise;
        clearTimeout(timeoutId);
      } catch (error) {
        const formattedError = handleError(error);
        console.error('[useBluetooth] Scan error:', formattedError);
        // Cleanup
        if (state.isScanning) {
          try {
            await BleManager.stopScan();
          } catch (stopError) {
            console.error(
              '[useBluetooth] Error stopping scan after failure:',
              stopError,
            );
          }
        }
        dispatch({ type: 'SET_ERROR', payload: formattedError });
        dispatch({ type: 'SCAN_STOP' });
        if (scanPromiseRef.current) {
          scanPromiseRef.current.reject(handleStateError(state.error));
          scanPromiseRef.current = null;
        }
        throw formattedError;
      }

      return scanPromiseRef.current?.promise;
    },
    [
      state.isBluetoothOn,
      state.hasPermissions,
      state.isScanning,
      state.error,
      dispatch,
    ],
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
      if (state.connectedDevice) {
        if (state.connectedDevice.id === deviceId) {
          console.warn(
            `[useBluetooth] Already connected to device ${deviceId}.`,
          );
          return state.connectedDevice;
        } else {
          throw new Error(
            `Already connected to a different device (${state.connectedDevice.id}). Disconnect first.`,
          );
        }
      }

      console.info(`[useBluetooth] Attempting connection to ${deviceId}...`);
      dispatch({ type: 'CONNECT_START' });

      // Create deferred promise
      connectPromiseRef.current = createDeferredPromise<Peripheral>();

      try {
        // --- Internal Connection Logic ---
        // 1. Connect
        await BleManager.connect(deviceId);
        console.info(
          `[useBluetooth] Peripheral ${deviceId} connected. Retrieving services...`,
        );

        // 2. Retrieve Services & Characteristics
        // Add a small delay before retrieving services, sometimes needed on Android
        if (Platform.OS === 'android') {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        }
        const peripheralInfo = await BleManager.retrieveServices(deviceId);
        console.info(
          `[useBluetooth] Services retrieved for ${deviceId}. Found:`,
          peripheralInfo.services?.map((s: { uuid: string }) => s.uuid),
          'Characteristics:',
          peripheralInfo.characteristics?.map(
            (c: { service: string; characteristic: string }) =>
              `${c.service}/${c.characteristic}`,
          ),
        );
        if (!peripheralInfo.services || peripheralInfo.services.length === 0) {
          throw new Error('No services found on this device.');
        }

        // 3. Find Compatible ELM327 Target
        let foundConfig: ActiveDeviceConfig | null = null;
        for (const target of KNOWN_ELM327_TARGETS) {
          const targetServiceUUIDUpper = target.serviceUUID.toUpperCase();
          const targetWriteCharUUIDUpper =
            target.writeCharacteristicUUID.toUpperCase();
          const targetNotifyCharUUIDUpper =
            target.notifyCharacteristicUUID.toUpperCase();

          // Find service match (full or short UUID)
          const foundService = peripheralInfo.services?.find(
            (s: { uuid: string }) => {
              const peripheralServiceUUIDUpper = s.uuid.toUpperCase();
              // Direct match (full UUID)
              if (peripheralServiceUUIDUpper === targetServiceUUIDUpper)
                return true;
              // Check if peripheral reported short UUID matches target's short UUID
              const shortTargetUUID = getShortUUID(targetServiceUUIDUpper);
              return (
                shortTargetUUID !== null &&
                peripheralServiceUUIDUpper === shortTargetUUID
              );
            },
          );

          if (foundService) {
            // Use the actual UUID reported by the peripheral for filtering characteristics
            const peripheralServiceUUIDActualUpper =
              foundService.uuid.toUpperCase();
            console.info(
              `[useBluetooth] Found matching service: ${target.name} (Target: ${target.serviceUUID}, Peripheral reported: ${foundService.uuid}). Checking characteristics...`,
            );

            // Filter characteristics based on the *actual* service UUID reported by the peripheral
            const characteristicsForService =
              peripheralInfo.characteristics?.filter(
                (c: { service: string }) =>
                  c.service.toUpperCase() === peripheralServiceUUIDActualUpper, // Use the matched peripheral service UUID
              ) ?? [];

            console.info(
              `[useBluetooth] Characteristics for service ${foundService.uuid}:`,
              characteristicsForService.map(
                (c: { characteristic: string }) => c.characteristic,
              ),
            );

            // Find write characteristic match (full or short UUID)
            const writeCharacteristic = characteristicsForService.find(
              (c: { characteristic: string }) => {
                const peripheralCharUUIDUpper = c.characteristic.toUpperCase();
                if (peripheralCharUUIDUpper === targetWriteCharUUIDUpper)
                  return true;
                const shortTargetUUID = getShortUUID(targetWriteCharUUIDUpper);
                return (
                  shortTargetUUID !== null &&
                  peripheralCharUUIDUpper === shortTargetUUID
                );
              },
            );

            // Find notify characteristic match (full or short UUID)
            const notifyCharacteristic = characteristicsForService.find(
              (c: { characteristic: string }) => {
                const peripheralCharUUIDUpper = c.characteristic.toUpperCase();
                if (peripheralCharUUIDUpper === targetNotifyCharUUIDUpper)
                  return true;
                const shortTargetUUID = getShortUUID(targetNotifyCharUUIDUpper);
                return (
                  shortTargetUUID !== null &&
                  peripheralCharUUIDUpper === shortTargetUUID
                );
              },
            );

            console.info(
              `[useBluetooth] Searching for Write Characteristic: ${target.writeCharacteristicUUID} (or short). Found: ${!!writeCharacteristic}`,
            );
            console.info(
              `[useBluetooth] Searching for Notify Characteristic: ${target.notifyCharacteristicUUID} (or short). Found: ${!!notifyCharacteristic}`,
            );

            if (writeCharacteristic && notifyCharacteristic) {
              console.info(
                `[useBluetooth] Found matching Write (${writeCharacteristic.characteristic}) and Notify (${notifyCharacteristic.characteristic}) characteristics.`,
              );

              // Determine Write Type based on *found* characteristic properties
              let writeType: ActiveDeviceConfig['writeType'] =
                'WriteWithoutResponse'; // Default
              if (writeCharacteristic.properties.Write) {
                writeType = 'Write';
                console.info(
                  '[useBluetooth] Characteristic supports Write (with response).',
                );
              } else if (writeCharacteristic.properties.WriteWithoutResponse) {
                console.info(
                  '[useBluetooth] Characteristic supports Write Without Response.',
                );
              } else {
                console.warn(
                  '[useBluetooth] Write characteristic found, but does not explicitly report Write or WriteWithoutResponse property. Assuming WriteWithoutResponse.',
                );
                // Keep default 'WriteWithoutResponse'
              }

              // 4. Start Notifications using the *actual* UUIDs found
              const serviceUUIDToUse = foundService.uuid;
              const notifyCharUUIDToUse = notifyCharacteristic.characteristic;
              console.info(
                `[useBluetooth] Starting notifications for Service ${serviceUUIDToUse} / Characteristic ${notifyCharUUIDToUse}...`,
              );
              await BleManager.startNotification(
                deviceId,
                serviceUUIDToUse, // Use actual found service UUID
                notifyCharUUIDToUse, // Use actual found notify characteristic UUID
              );
              console.info(
                `[useBluetooth] Notifications started for ${notifyCharUUIDToUse}.`,
              );

              foundConfig = {
                // Store the actual UUIDs used for communication
                serviceUUID: serviceUUIDToUse,
                writeCharacteristicUUID: writeCharacteristic.characteristic,
                notifyCharacteristicUUID: notifyCharUUIDToUse,
                writeType: writeType,
              };
              break; // Found a compatible configuration
            } else {
              console.info(
                `[useBluetooth] Service ${foundService.uuid} found, but required characteristics (Write: ${target.writeCharacteristicUUID}, Notify: ${target.notifyCharacteristicUUID}) not found within it.`,
              );
            }
          }
        } // End loop through known targets

        // 5. Handle Connection Result
        if (foundConfig) {
          console.info(
            `[useBluetooth] Compatible configuration found and notifications started. Connection successful to ${deviceId}.`,
          );
          dispatch({
            type: 'CONNECT_SUCCESS',
            payload: { device: peripheralInfo, config: foundConfig },
          });
          connectPromiseRef.current?.resolve(peripheralInfo);
          connectPromiseRef.current = null; // Clear ref
          return peripheralInfo;
        } else {
          console.error(
            '[useBluetooth] Connection failed: No compatible ELM327 service/characteristic configuration found.',
          );
          throw new Error(
            'Incompatible OBD device or required services not found.',
          );
        }
      } catch (error) {
        const formattedError = handleError(error);
        console.error(
          `[useBluetooth] Connection process failed for ${deviceId}:`,
          formattedError,
        );
        dispatch({
          type: 'CONNECT_FAILURE',
          payload: formattedError,
        });
        // Attempt cleanup: disconnect if possible
        try {
          await BleManager.disconnect(deviceId);
          console.info(
            `[useBluetooth] Disconnected device ${deviceId} after connection failure.`,
          );
        } catch (disconnectError) {
          console.error(
            `[useBluetooth] Error disconnecting after connection failure for ${deviceId}:`,
            disconnectError,
          );
        }
        connectPromiseRef.current?.reject(formattedError);
        connectPromiseRef.current = null; // Clear ref
        throw formattedError; // Re-throw error
      }
    },
    [state.isConnecting, state.connectedDevice, dispatch],
  );

  // --- Disconnection Function ---

  const disconnect = useCallback(async (): Promise<void> => {
    if (state.isDisconnecting) {
      console.warn('[useBluetooth] Disconnection already in progress.');
      return disconnectPromiseRef.current?.promise ?? Promise.resolve();
    }
    if (!state.connectedDevice || !state.activeDeviceConfig) {
      console.warn('[useBluetooth] No device currently connected.');
      return Promise.resolve();
    }

    const deviceId = state.connectedDevice.id;
    const config = state.activeDeviceConfig;
    console.info(`[useBluetooth] Disconnecting from ${deviceId}...`);
    dispatch({ type: 'DISCONNECT_START' });

    // Create deferred promise
    disconnectPromiseRef.current = createDeferredPromise<void>();

    try {
      // 1. Stop Notifications
      console.info(
        `[useBluetooth] Stopping notifications for ${config.notifyCharacteristicUUID}...`,
      );
      await BleManager.stopNotification(
        deviceId,
        config.serviceUUID,
        config.notifyCharacteristicUUID,
      );
      console.info('[useBluetooth] Notifications stopped.');

      // 2. Disconnect Peripheral
      await BleManager.disconnect(deviceId);
      console.info(
        `[useBluetooth] BleManager.disconnect called for ${deviceId}.`,
      );

      // Note: The DEVICE_DISCONNECTED action triggered by the BleManagerDisconnectPeripheral
      // listener will handle the state update (setting connectedDevice to null, etc.)
      // We resolve the promise here assuming the disconnect call initiated successfully.
      // The listener acts as confirmation.
      dispatch({ type: 'DISCONNECT_SUCCESS' }); // Optional: signal immediate success after call
      disconnectPromiseRef.current?.resolve();
    } catch (error) {
      const formattedError = handleError(error);
      console.error(
        `[useBluetooth] Disconnect failed for ${deviceId}:`,
        formattedError,
      );
      dispatch({
        type: 'DISCONNECT_FAILURE',
        payload: formattedError,
      });
      disconnectPromiseRef.current?.reject(formattedError);
      throw formattedError; // Re-throw
    } finally {
      disconnectPromiseRef.current = null; // Clear ref
    }
  }, [
    state.connectedDevice,
    state.activeDeviceConfig,
    state.isDisconnecting,
    dispatch,
  ]);

  // --- Command Functions ---

  // Updated executeCommand to handle the chunked return type
  const executeCommand = useCallback(
    async (
      command: string,
      returnType: string,
      options?: { timeout?: number },
    ): Promise<string | Uint8Array | ChunkedResponse> => {
      if (!state.connectedDevice || !state.activeDeviceConfig) {
        throw new Error('Not connected to a device.');
      }
      if (state.isAwaitingResponse) {
        throw new Error('Another command is already in progress.');
      }
      if (currentCommandRef.current) {
        console.warn('[useBluetooth] Stale command ref found - clearing.');
        if (currentCommandRef.current.timeoutId)
          clearTimeout(currentCommandRef.current.timeoutId);
        currentCommandRef.current.promise.reject(
          new Error('Command cancelled due to new command starting.'),
        );
        currentCommandRef.current = null;
      }

      const config = state.activeDeviceConfig;
      const deviceId = state.connectedDevice.id;
      const commandTimeoutDuration =
        options?.timeout ?? DEFAULT_COMMAND_TIMEOUT;

      console.info(
        `[useBluetooth] Sending command: "${command}" (Expect: ${returnType}, Timeout: ${commandTimeoutDuration}ms)`,
      );

      const deferredPromise = createDeferredPromise<
        string | Uint8Array | ChunkedResponse
      >();
      let timeoutId: NodeJS.Timeout | null = null;

      currentCommandRef.current = {
        promise: deferredPromise,
        timeoutId: null,
        responseBuffer: [],
        responseChunks: [], // Initialize empty response chunks array
        expectedReturnType: returnType as 'string' | 'bytes' | 'chunked',
      };

      dispatch({ type: 'SEND_COMMAND_START' });

      timeoutId = setTimeout(() => {
        if (currentCommandRef.current?.promise === deferredPromise) {
          const error = new Error(
            `Command "${command}" timed out after ${commandTimeoutDuration}ms.`,
          );
          console.error(`[useBluetooth] ${error.message}`);
          dispatch({ type: 'COMMAND_TIMEOUT' });
          deferredPromise.reject(error);
          currentCommandRef.current = null;
        }
      }, commandTimeoutDuration);

      if (currentCommandRef.current) {
        currentCommandRef.current.timeoutId = timeoutId;
      }

      try {
        const commandString = command + ELM327_COMMAND_TERMINATOR;
        const commandBytes = Array.from(
          new TextEncoder().encode(commandString),
        );

        if (config.writeType === 'Write') {
          await BleManager.write(
            deviceId,
            config.serviceUUID,
            config.writeCharacteristicUUID,
            commandBytes,
          );
        } else {
          await BleManager.writeWithoutResponse(
            deviceId,
            config.serviceUUID,
            config.writeCharacteristicUUID,
            commandBytes,
          );
        }
        console.info(
          `[useBluetooth] Command "${command}" written. Waiting for response from Provider...`,
        );

        const response = await deferredPromise.promise;
        return response;
      } catch (error) {
        const formattedError = handleError(error);
        console.error(
          `[useBluetooth] Error during command execution or processing "${command}":`,
          formattedError,
        );
        if (
          currentCommandRef.current?.promise === deferredPromise &&
          currentCommandRef.current.timeoutId
        ) {
          clearTimeout(currentCommandRef.current.timeoutId);
        }
        if (
          state.isAwaitingResponse &&
          currentCommandRef.current?.promise === deferredPromise
        ) {
          dispatch({
            type: 'COMMAND_FAILURE',
            payload: formattedError,
          });
        }
        if (currentCommandRef.current?.promise === deferredPromise) {
          currentCommandRef.current = null;
        }
        throw formattedError;
      }
    },
    [
      state.connectedDevice,
      state.activeDeviceConfig,
      state.isAwaitingResponse,
      dispatch,
      currentCommandRef,
    ],
  );

  const sendCommand = useCallback(
    async (
      command: string,
      options?: { timeout?: number },
    ): Promise<string> => {
      const result = await executeCommand(
        command,
        CommandReturnType.STRING,
        options,
      );
      if (typeof result !== 'string') {
        throw new Error(
          'Internal error: Expected string response but received bytes or chunks.',
        );
      }
      return result;
    },
    [executeCommand],
  );

  const sendCommandRaw = useCallback(
    async (
      command: string,
      options?: { timeout?: number },
    ): Promise<Uint8Array> => {
      const result = await executeCommand(
        command,
        CommandReturnType.BYTES,
        options,
      );
      if (!(result instanceof Uint8Array)) {
        throw new Error(
          'Internal error: Expected byte response but received string or chunks.',
        );
      }
      return result;
    },
    [executeCommand],
  );

  // New function for chunked responses
  const sendCommandRawChunked = useCallback(
    async (
      command: string,
      options?: { timeout?: number },
    ): Promise<ChunkedResponse> => {
      const result = await executeCommand(
        command,
        CommandReturnType.CHUNKED,
        options,
      );
      if (typeof result === 'string' || result instanceof Uint8Array) {
        throw new Error(
          'Internal error: Expected chunked response but received string or bytes.',
        );
      }
      return result as ChunkedResponse;
    },
    [executeCommand],
  );

  const setStreaming = useCallback(
    (shouldStream: boolean): void => {
      if (!state.connectedDevice && shouldStream) {
        console.error(
          '[useBluetooth] Cannot start streaming: No device connected.',
        );
        return;
      }

      // Only dispatch if the state is actually changing
      if (state.isStreaming !== shouldStream) {
        console.info(
          `[useBluetooth] Setting streaming status to: ${shouldStream}`,
        );
        dispatch({ type: 'SET_STREAMING_STATUS', payload: shouldStream });
      } else {
        console.info(
          `[useBluetooth] Streaming status is already ${shouldStream}. No change.`,
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
    if (scanPromiseRef.current && !state.isScanning) {
      if (state.error && state.error.message.includes('Scan timed out')) {
        scanPromiseRef.current.resolve();
      } else if (state.error) {
        scanPromiseRef.current.reject(handleStateError(state.error));
      } else {
        scanPromiseRef.current.resolve();
      }
      scanPromiseRef.current = null;
    }
  }, [state.isScanning, state.error]);

  // Add new useEffect for currentCommandRef dependency
  useEffect(() => {
    // Handle currentCommandRef changes if needed
    return () => {
      if (currentCommandRef.current?.timeoutId) {
        clearTimeout(currentCommandRef.current.timeoutId);
      }
    };
  }, [currentCommandRef]);

  // --- Effect to process incoming data for sendCommand ---
  // This is where the logic connecting DATA_RECEIVED actions to the commandPromise lives.
  // This *could* live here, but is often better placed in the Provider to directly
  // access the commandPromiseRef without prop drilling or complex context.
  // For simplicity *initially*, we might put it here, but consider moving it.
  useEffect(() => {
    if (state.isAwaitingResponse && currentCommandRef.current) {
      // Check the buffer for the prompt character '>' (0x3E)
      const promptIndex =
        currentCommandRef.current.responseBuffer.indexOf(ELM327_PROMPT_BYTE);
      if (promptIndex !== -1) {
        console.info('[useBluetooth] Prompt ">" detected in buffer.');

        // Extract the response bytes (excluding the prompt)
        const responseBytes = currentCommandRef.current.responseBuffer.slice(
          0,
          promptIndex,
        );
        currentCommandRef.current.responseBuffer = []; // Clear buffer

        // Clear the timeout!
        if (currentCommandRef.current.timeoutId)
          clearTimeout(currentCommandRef.current.timeoutId);
        currentCommandRef.current.timeoutId = null;

        // Decode response bytes to string (assuming ASCII/UTF-8 typical for ELM327)
        // Use TextDecoder for better performance and encoding support if available
        let responseString = '';
        try {
          responseString = new TextDecoder()
            .decode(Uint8Array.from(responseBytes))
            .trim();
          // console.log("Decoded response:", responseString);
        } catch (e) {
          console.warn(
            '[useBluetooth] TextDecoder failed, falling back to fromCharCode:',
            e,
          );
          // Fallback for environments without TextDecoder or for simple ASCII
          responseString = String.fromCharCode(...responseBytes).trim();
        }

        // Resolve the command promise with the string
        currentCommandRef.current?.promise.resolve(responseString);
        // currentCommandRef.current = null; // Cleared in sendCommand finally block
        // Dispatch success action to reset isAwaitingResponse flag in state
        // (This happens in sendCommand after await resolves)
        // dispatch({ type: 'COMMAND_SUCCESS' }); // NO! Done in sendCommand
      }
    }
  }, [state.isAwaitingResponse, currentCommandRef]);

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
    sendCommand,

    // TODO Functions (return placeholders)
    requestBluetoothPermissions,
    promptEnableBluetooth,
    sendCommandRaw,
    sendCommandRawChunked,
    setStreaming,
  };
};
