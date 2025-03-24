import { useCallback, useEffect } from 'react';

import useBluetooth from '../hooks/useBluetooth';
import commandHandler from '../utils/commandHandler';
import { BluetoothOBDError, BluetoothErrorType } from '../utils/errorUtils';
import notificationHandler from '../utils/notificationHandler';
import {
  ELM_COMMANDS,
  STANDARD_PIDS,
  ECUConnector,
  createRawECUConnector,
  createDecodedECUConnector,
} from '../utils/obdUtils';

export interface ECUCommandsHook {
  initializeECU: () => Promise<boolean>;
  getVIN: () => Promise<string | null>;
  getEngineRPM: () => Promise<number | null>;
  getVehicleSpeed: () => Promise<number | null>;
  getEngineCoolantTemp: () => Promise<number | null>;
  getBatteryVoltage: () => Promise<number | null>;
  getTroubleCodes: () => Promise<string[] | null>;
  clearTroubleCodes: () => Promise<boolean>;
  getRawConnector: () => ECUConnector | null;
  getDecodedConnector: () => ECUConnector | null;
  isReady: boolean;
}

/**
 * Hook for working with ECU commands
 * Provides functions for common OBD operations
 * @returns ECU command functions and connection state
 */
export const useECUCommands = (): ECUCommandsHook => {
  const { connectedDevice, connectionDetails, sendCommand: rawSendCommand } = useBluetooth();

  // Initialize handlers
  useEffect(() => {
    if (connectedDevice?.id) {
      notificationHandler.setActivePeripheral(connectedDevice.id);
    }
    return () => {
      notificationHandler.reset();
      commandHandler.reset();
    };
  }, [connectedDevice?.id]);

  // Enhanced send command with automatic retries and proper cleanup
  const sendCommand = useCallback(
    async (command: string, timeoutMs?: number): Promise<string> => {
      if (!connectedDevice || !connectionDetails) {
        throw new BluetoothOBDError(BluetoothErrorType.CONNECTION_ERROR, 'No device connected');
      }

      const writeFn = async () => {
        try {
          await rawSendCommand(command, timeoutMs);
        } catch (error) {
          throw new BluetoothOBDError(
            BluetoothErrorType.WRITE_ERROR,
            `Failed to write command: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      };

      return commandHandler.sendCommand(command, writeFn, connectedDevice.id, timeoutMs);
    },
    [connectedDevice, connectionDetails, rawSendCommand],
  );

  const initializeECU = useCallback(async (): Promise<boolean> => {
    try {
      // Reset
      await sendCommand('ATZ');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Configure ECU
      await sendCommand('ATE0'); // Echo off
      await sendCommand('ATL0'); // Linefeeds off
      await sendCommand('ATH0'); // Headers off
      await sendCommand('ATS0'); // Spaces off
      await sendCommand('ATSP0'); // Auto protocol

      return true;
    } catch (error) {
      console.error('Failed to initialize ECU:', error);
      return false;
    }
  }, [sendCommand]);

  const getVIN = useCallback(async (): Promise<string | null> => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.VIN.pid);
      return response.replace(/\s+/g, '');
    } catch (error) {
      console.error('Failed to get VIN:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  const getEngineRPM = useCallback(async (): Promise<number | null> => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.ENGINE_RPM.pid);
      const hexValue = response.replace(/\s+/g, '');
      const a = parseInt(hexValue.substring(0, 2), 16);
      const b = parseInt(hexValue.substring(2, 4), 16);
      return (a * 256 + b) / 4;
    } catch (error) {
      console.error('Failed to get RPM:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  const getVehicleSpeed = useCallback(async (): Promise<number | null> => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.VEHICLE_SPEED.pid);
      const hexValue = response.replace(/\s+/g, '');
      return parseInt(hexValue.substring(0, 2), 16);
    } catch (error) {
      console.error('Failed to get speed:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  const getEngineCoolantTemp = useCallback(async (): Promise<number | null> => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.ENGINE_COOLANT_TEMP.pid);
      const hexValue = response.replace(/\s+/g, '');
      return parseInt(hexValue.substring(0, 2), 16) - 40;
    } catch (error) {
      console.error('Failed to get coolant temp:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  const getBatteryVoltage = useCallback(async (): Promise<number | null> => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand(ELM_COMMANDS.VOLTAGE);
      const voltageStr = response.replace(/[^0-9.]/g, '');
      return parseFloat(voltageStr);
    } catch (error) {
      console.error('Failed to get battery voltage:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  const getTroubleCodes = useCallback(async (): Promise<string[] | null> => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand('03');
      const codes: string[] = [];
      const hexData = response.replace(/\s+/g, '').match(/[0-9A-F]{4}/g) || [];

      for (const code of hexData) {
        const firstChar = parseInt(code[0], 16);
        const prefix = ['P', 'C', 'B', 'U'][firstChar >> 2] || 'P';
        const digits = (((firstChar & 0x03) << 14) | parseInt(code.slice(1), 16))
          .toString(16)
          .toUpperCase()
          .padStart(4, '0');
        codes.push(prefix + digits);
      }

      return codes;
    } catch (error) {
      console.error('Failed to get trouble codes:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  const clearTroubleCodes = useCallback(async (): Promise<boolean> => {
    if (!connectedDevice) return false;
    try {
      await sendCommand('04');
      return true;
    } catch (error) {
      console.error('Failed to clear trouble codes:', error);
      return false;
    }
  }, [connectedDevice, sendCommand]);

  const getRawConnector = useCallback((): ECUConnector | null => {
    if (!connectedDevice || !sendCommand) return null;
    return createRawECUConnector({
      sendCommand,
      disconnect: async () => {
        // Disconnection is handled by the BluetoothContext
        return Promise.resolve();
      },
      isConnected: () => !!connectedDevice,
    });
  }, [connectedDevice, sendCommand]);

  const getDecodedConnector = useCallback((): ECUConnector | null => {
    if (!connectedDevice || !sendCommand) return null;
    return createDecodedECUConnector({
      sendCommand,
      disconnect: async () => {
        // Disconnection is handled by the BluetoothContext
        return Promise.resolve();
      },
      isConnected: () => !!connectedDevice,
    });
  }, [connectedDevice, sendCommand]);

  return {
    initializeECU,
    getVIN,
    getEngineRPM,
    getVehicleSpeed,
    getEngineCoolantTemp,
    getBatteryVoltage,
    getTroubleCodes,
    clearTroubleCodes,
    getRawConnector,
    getDecodedConnector,
    isReady: !!connectedDevice && !!connectionDetails,
  };
};
