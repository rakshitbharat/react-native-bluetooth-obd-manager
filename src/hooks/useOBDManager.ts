import { useCallback, useEffect, useState } from 'react';

import useBluetooth from '../hooks/useBluetooth';
import DeviceCompatibilityManager from '../utils/deviceCompatibility';
import { BluetoothOBDError, BluetoothErrorType } from '../utils/errorUtils';
import {
  ELM_COMMANDS,
  OBD_MODES,
  formatPidCommand,
  convertPidValue,
  parseDTCResponse,
} from '../utils/obdUtils';

// Default connection timeout
const DEFAULT_TIMEOUT = 10000;
// Default command timeout
const DEFAULT_COMMAND_TIMEOUT = 4000;

export interface OBDManagerProps {
  onConnected?: (deviceId: string) => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  autoInit?: boolean;
  connectToLast?: boolean;
}

/**
 * OBDManager hook - Main interface for OBD operations
 *
 * Provides functions to interact with OBD devices including:
 * - Device connection management
 * - Send OBD commands
 * - Get live vehicle data (RPM, speed, etc.)
 * - Read diagnostic trouble codes
 */
export const useOBDManager = ({
  onConnected,
  onDisconnected,
  onError,
  autoInit = true,
  connectToLast = true,
}: OBDManagerProps = {}) => {
  const bluetooth = useBluetooth();

  // State for OBD manager
  const [initialized, setInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [obdProtocol, setObdProtocol] = useState<string | null>(null);
  const [supportedPIDs, setSupportedPIDs] = useState<string[]>([]);
  const [vin, setVin] = useState<string | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'ready'>(
    'disconnected',
  );
  const [lastError, setLastError] = useState<Error | null>(null);

  // Initialize OBD interface with the device
  const initializeOBD = useCallback(async () => {
    if (!bluetooth.isConnected || initializing) {
      return false;
    }

    setInitializing(true);
    setLastError(null);

    try {
      // Reset adapter
      await bluetooth.sendCommand(ELM_COMMANDS.RESET);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Configure the adapter with optimal settings
      await bluetooth.sendCommand(ELM_COMMANDS.ECHO_OFF);
      await bluetooth.sendCommand(ELM_COMMANDS.LINEFEEDS_OFF);
      await bluetooth.sendCommand(ELM_COMMANDS.HEADERS_OFF);

      // Try to use automatic protocol
      await bluetooth.sendCommand(ELM_COMMANDS.AUTO_PROTOCOL);

      // Get adapter version
      const version = await bluetooth.sendCommand(ELM_COMMANDS.GET_VERSION);
      console.log('Adapter version:', version);

      // Get the protocol
      try {
        const protocol = await bluetooth.sendCommand(ELM_COMMANDS.DESCRIBE_PROTOCOL_NUMERIC);
        setObdProtocol(protocol);
      } catch (error) {
        console.warn('Failed to get protocol:', error);
        // Continue anyway as this is not critical
      }

      // Try to get supported PIDs
      try {
        // Mode 1 PIDs 1-20
        const pids01 = await bluetooth.sendCommand(formatPidCommand(OBD_MODES.CURRENT_DATA, '00'));

        // Parse the response to determine supported PIDs
        // This is a complex bit-field parsing that we'll implement in a simplified way here
        const pidList: string[] = [];
        if (pids01 && pids01.length > 0) {
          // Process first PID response
          console.log('Supported PIDs 01-20:', pids01);

          // Add some common PIDs that are usually supported
          pidList.push('0C'); // RPM
          pidList.push('0D'); // Speed
          pidList.push('05'); // Coolant temp
          pidList.push('0F'); // Intake temp
          pidList.push('11'); // Throttle
        }

        setSupportedPIDs(pidList);
      } catch (error) {
        console.warn('Failed to get supported PIDs:', error);
        // Continue anyway as we'll fallback to common PIDs
      }

      // Try to get VIN
      try {
        const vinResponse = await bluetooth.sendCommand(
          formatPidCommand(OBD_MODES.REQUEST_VEHICLE_INFO, '02'),
        );
        // VIN response needs special parsing but we'll skip this for simplicity
        console.log('VIN response:', vinResponse);
        // A basic VIN extraction - in reality this would be more complex
        const extractedVin = extractVIN(vinResponse);
        setVin(extractedVin);
      } catch (error) {
        console.warn('Failed to get VIN:', error);
        // Continue anyway as this is not critical
      }

      setInitialized(true);
      setStatus('ready');
      return true;
    } catch (error) {
      const obd_error =
        error instanceof Error ? error : new Error('Unknown error during OBD initialization');
      setLastError(obd_error);
      onError?.(obd_error);
      return false;
    } finally {
      setInitializing(false);
    }
  }, [bluetooth, initializing, onError]);

  // Extract VIN from ELM327 response
  // (This is a simplified version, real implementation would be more complex)
  const extractVIN = (response: string): string | null => {
    if (!response) return null;

    try {
      // Strip all non-alphanumeric characters
      const cleaned = response.replace(/[^A-Za-z0-9]/g, '');

      // Look for a pattern that could be a VIN (17 characters)
      for (let i = 0; i <= cleaned.length - 17; i++) {
        const potential = cleaned.substring(i, i + 17);
        // VINs have specific formats we could check more thoroughly
        if (/^[A-HJ-NPR-Z0-9]{17}$/.test(potential)) {
          return potential;
        }
      }

      return null;
    } catch {
      return null;
    }
  };

  // Connect to an OBD device
  const connectToDevice = useCallback(
    async (deviceId: string): Promise<boolean> => {
      try {
        setStatus('connecting');
        setLastError(null);

        const success = await bluetooth.connectToDevice(deviceId);

        if (success) {
          setStatus('connected');
          onConnected?.(deviceId);

          // If the device is connected, record in compatibility manager
          if (bluetooth.connectedDevice && bluetooth.connectionDetails) {
            await DeviceCompatibilityManager.recordSuccessfulConnection(
              deviceId,
              bluetooth.connectedDevice.name || 'Unknown Device',
              bluetooth.connectionDetails,
              true, // Assume it's an OBD device since we're using this manager
            );
          }

          // Initialize the OBD interface
          await initializeOBD();
          return true;
        } else {
          setStatus('disconnected');
          const error = new BluetoothOBDError(
            BluetoothErrorType.CONNECTION_ERROR,
            `Failed to connect to device: ${deviceId}`,
          );
          setLastError(error);
          onError?.(error);
          return false;
        }
      } catch (error) {
        setStatus('disconnected');
        const obd_error =
          error instanceof Error
            ? error
            : new BluetoothOBDError(
                BluetoothErrorType.CONNECTION_ERROR,
                `Error connecting to device: ${deviceId}`,
              );
        setLastError(obd_error);
        onError?.(obd_error);
        return false;
      }
    },
    [bluetooth, initializeOBD, onConnected, onError],
  );

  // Scan for OBD devices
  const scanForDevices = useCallback(
    async (timeoutMs = 5000): Promise<boolean> => {
      try {
        return await bluetooth.scanDevices(timeoutMs);
      } catch (error) {
        const obd_error =
          error instanceof Error
            ? error
            : new BluetoothOBDError(BluetoothErrorType.UNKNOWN_ERROR, 'Error scanning for devices');
        setLastError(obd_error);
        onError?.(obd_error);
        return false;
      }
    },
    [bluetooth, onError],
  );

  // Disconnect from device
  const disconnect = useCallback(async (): Promise<boolean> => {
    try {
      if (!bluetooth.isConnected || !bluetooth.connectedDevice) {
        return true; // Already disconnected
      }

      const success = await bluetooth.disconnect(bluetooth.connectedDevice.id);

      if (success) {
        setStatus('disconnected');
        setInitialized(false);
        onDisconnected?.();
      }

      return success;
    } catch (error) {
      const obd_error =
        error instanceof Error
          ? error
          : new BluetoothOBDError(
              BluetoothErrorType.DISCONNECTION_ERROR,
              'Error disconnecting from device',
            );
      setLastError(obd_error);
      onError?.(obd_error);
      return false;
    }
  }, [bluetooth, onDisconnected, onError]);

  // Send raw OBD command
  const sendCommand = useCallback(
    async (command: string, timeoutMs = DEFAULT_COMMAND_TIMEOUT): Promise<string> => {
      try {
        if (!bluetooth.isConnected) {
          throw new BluetoothOBDError(
            BluetoothErrorType.CONNECTION_ERROR,
            'Not connected to any device',
          );
        }

        if (!initialized && !command.startsWith('AT')) {
          // For non-AT commands, make sure the OBD interface is initialized
          if (!initializing) {
            await initializeOBD();
          }
        }

        return await bluetooth.sendCommand(command, timeoutMs);
      } catch (error) {
        const obd_error =
          error instanceof Error
            ? error
            : new BluetoothOBDError(
                BluetoothErrorType.WRITE_ERROR,
                `Error sending command: ${command}`,
              );
        setLastError(obd_error);
        onError?.(obd_error);
        throw obd_error;
      }
    },
    [bluetooth, initialized, initializing, initializeOBD, onError],
  );

  // Get current vehicle RPM
  const getRPM = useCallback(async (): Promise<number | null> => {
    try {
      const command = formatPidCommand(OBD_MODES.CURRENT_DATA, '0C');
      const response = await sendCommand(command);
      const value = convertPidValue(response, command);
      return typeof value === 'number' ? value : null;
    } catch (error) {
      console.warn('Failed to get RPM:', error);
      return null;
    }
  }, [sendCommand]);

  // Get current vehicle speed (km/h)
  const getSpeed = useCallback(async (): Promise<number | null> => {
    try {
      const command = formatPidCommand(OBD_MODES.CURRENT_DATA, '0D');
      const response = await sendCommand(command);
      const value = convertPidValue(response, command);
      return typeof value === 'number' ? value : null;
    } catch (error) {
      console.warn('Failed to get speed:', error);
      return null;
    }
  }, [sendCommand]);

  // Get engine coolant temperature (°C)
  const getCoolantTemp = useCallback(async (): Promise<number | null> => {
    try {
      const command = formatPidCommand(OBD_MODES.CURRENT_DATA, '05');
      const response = await sendCommand(command);
      const value = convertPidValue(response, command);
      return typeof value === 'number' ? value : null;
    } catch (error) {
      console.warn('Failed to get coolant temperature:', error);
      return null;
    }
  }, [sendCommand]);

  // Get Diagnostic Trouble Codes (DTCs)
  const getDiagnosticCodes = useCallback(async (): Promise<string[]> => {
    try {
      const command = OBD_MODES.STORED_TROUBLE_CODES; // Mode 03
      const response = await sendCommand(command);
      return parseDTCResponse(response);
    } catch (error) {
      console.warn('Failed to get diagnostic codes:', error);
      return [];
    }
  }, [sendCommand]);

  // Clear Diagnostic Trouble Codes
  const clearDiagnosticCodes = useCallback(async (): Promise<boolean> => {
    try {
      const command = OBD_MODES.CLEAR_TROUBLE_CODES; // Mode 04
      await sendCommand(command);
      return true;
    } catch (error) {
      console.warn('Failed to clear diagnostic codes:', error);
      return false;
    }
  }, [sendCommand]);

  // Get vehicle identification number
  const getVIN = useCallback(async (): Promise<string | null> => {
    try {
      // Use cached VIN if available
      if (vin) return vin;

      const command = formatPidCommand(OBD_MODES.REQUEST_VEHICLE_INFO, '02');
      const response = await sendCommand(command);
      const extractedVin = extractVIN(response);

      if (extractedVin) {
        setVin(extractedVin);
      }

      return extractedVin;
    } catch (error) {
      console.warn('Failed to get VIN:', error);
      return null;
    }
  }, [sendCommand, vin]);

  // Get battery voltage from adapter
  const getBatteryVoltage = useCallback(async (): Promise<number | null> => {
    try {
      const response = await sendCommand(ELM_COMMANDS.VOLTAGE);

      // Parse voltage from response
      const match = response.match(/([0-9]+\.[0-9]+)V?/);
      if (match && match[1]) {
        return parseFloat(match[1]);
      }

      return null;
    } catch (error) {
      console.warn('Failed to get battery voltage:', error);
      return null;
    }
  }, [sendCommand]);

  // Get multiple data points at once for more efficient polling
  const getLiveData = useCallback(async (): Promise<{
    rpm?: number;
    speed?: number;
    coolantTemp?: number;
    throttlePosition?: number;
    error?: string;
  }> => {
    const result: {
      rpm?: number;
      speed?: number;
      coolantTemp?: number;
      throttlePosition?: number;
      error?: string;
    } = {};

    try {
      // Get RPM
      const rpmValue = await getRPM();
      if (rpmValue !== null) {
        result.rpm = rpmValue;
      }

      // Get Speed
      const speedValue = await getSpeed();
      if (speedValue !== null) {
        result.speed = speedValue;
      }

      // Get Coolant Temp
      const coolantValue = await getCoolantTemp();
      if (coolantValue !== null) {
        result.coolantTemp = coolantValue;
      }

      // Get Throttle Position
      try {
        const command = formatPidCommand(OBD_MODES.CURRENT_DATA, '11');
        const response = await sendCommand(command);
        const value = convertPidValue(response, command);
        result.throttlePosition = typeof value === 'number' ? value : undefined;
      } catch (error) {
        // Just skip throttle if it fails
      }

      return result;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error getting live data',
      };
    }
  }, [getRPM, getSpeed, getCoolantTemp, sendCommand]);

  // Try to reconnect to the last device on startup
  useEffect(() => {
    const tryConnectToLast = async () => {
      if (autoInit && connectToLast && !bluetooth.isConnected) {
        try {
          await bluetooth.reconnectToLastDevice();
          // If successful, initialize OBD
          if (bluetooth.isConnected) {
            await initializeOBD();
          }
        } catch (error) {
          console.warn('Failed to connect to last device:', error);
        }
      }
    };

    tryConnectToLast();
  }, [autoInit, bluetooth, connectToLast, initializeOBD]);

  // Update the connection status based on bluetooth state changes
  useEffect(() => {
    if (bluetooth.isConnected) {
      setStatus(initialized ? 'ready' : 'connected');
    } else {
      setStatus('disconnected');
    }
  }, [bluetooth.isConnected, initialized]);

  return {
    // Connection management
    connectToDevice,
    disconnect,
    scanForDevices,
    reconnectToLastDevice: bluetooth.reconnectToLastDevice,
    getRecentDevices: bluetooth.getRecentDevices,

    // Status information
    initialized,
    initializing,
    status,
    isConnected: bluetooth.isConnected,
    connectedDevice: bluetooth.connectedDevice,
    lastError,
    obdProtocol,
    supportedPIDs,

    // Device initialization
    initializeOBD,

    // Command handling
    sendCommand,

    // Vehicle data
    getRPM,
    getSpeed,
    getCoolantTemp,
    getLiveData,
    getDiagnosticCodes,
    clearDiagnosticCodes,
    getVIN,
    getBatteryVoltage,

    // Underlying Bluetooth access (for advanced usage)
    bluetooth,
  };
};
