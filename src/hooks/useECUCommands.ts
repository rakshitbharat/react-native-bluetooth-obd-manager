import { useCallback, useEffect } from 'react';
import { useBluetooth } from './useBluetooth';
import commandHandler from '../utils/commandHandler';
import notificationHandler from '../utils/notificationHandler';
import { BluetoothOBDError, BluetoothErrorType } from '../utils/errorUtils';
import {
  ELM_COMMANDS,
  STANDARD_PIDS,
  createDecodedECUConnector,
  createRawECUConnector,
  ECUConnector,
} from '../utils/obdUtils';

/**
 * Hook for working with ECU commands
 * Provides functions for common OBD operations
 */
export const useECUCommands = () => {
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

      // Create write function for the command handler
      const writeFn = async (bytes: number[]) => {
        if (connectionDetails.writeWithResponse) {
          await rawSendCommand(command, timeoutMs);
        } else {
          await rawSendCommand(command, timeoutMs);
        }
      };

      return commandHandler.sendCommand(command, writeFn, connectedDevice.id, timeoutMs);
    },
    [connectedDevice, connectionDetails, rawSendCommand],
  );

  // Initialize ECU with standard commands
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

  /**
   * Get vehicle identification number
   */
  const getVIN = useCallback(async () => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.VIN);
      return response;
    } catch (error) {
      console.error('Failed to get VIN:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  /**
   * Get current engine RPM
   */
  const getEngineRPM = useCallback(async () => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.ENGINE_RPM);
      // Would need to convert the response to actual RPM value
      return response;
    } catch (error) {
      console.error('Failed to get RPM:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  /**
   * Get current vehicle speed in km/h
   */
  const getVehicleSpeed = useCallback(async () => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.VEHICLE_SPEED);
      return response;
    } catch (error) {
      console.error('Failed to get speed:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  /**
   * Get current engine coolant temperature
   */
  const getEngineCoolantTemp = useCallback(async () => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.ENGINE_COOLANT_TEMP);
      return response;
    } catch (error) {
      console.error('Failed to get coolant temp:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  /**
   * Get battery voltage
   */
  const getBatteryVoltage = useCallback(async () => {
    if (!connectedDevice) return null;
    try {
      const response = await sendCommand(ELM_COMMANDS.READ_VOLTAGE);
      return response;
    } catch (error) {
      console.error('Failed to get battery voltage:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  /**
   * Get diagnostic trouble codes (DTCs)
   */
  const getTroubleCodes = useCallback(async () => {
    if (!connectedDevice) return null;
    try {
      // Mode 03 retrieves confirmed DTCs
      const response = await sendCommand('03');
      return response;
    } catch (error) {
      console.error('Failed to get trouble codes:', error);
      return null;
    }
  }, [connectedDevice, sendCommand]);

  /**
   * Clear diagnostic trouble codes
   */
  const clearTroubleCodes = useCallback(async () => {
    if (!connectedDevice) return false;
    try {
      // Mode 04 clears DTCs
      await sendCommand('04');
      return true;
    } catch (error) {
      console.error('Failed to clear trouble codes:', error);
      return false;
    }
  }, [connectedDevice, sendCommand]);

  /**
   * Create raw data connector for custom implementations
   */
  const getRawConnector = useCallback((): ECUConnector | null => {
    if (!connectedDevice || !sendCommand) return null;
    return createRawECUConnector(sendCommand);
  }, [connectedDevice, sendCommand]);

  /**
   * Create decoded data connector for custom implementations
   */
  const getDecodedConnector = useCallback((): ECUConnector | null => {
    if (!connectedDevice || !sendCommand) return null;
    return createDecodedECUConnector(sendCommand);
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
