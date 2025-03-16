import { useCallback } from 'react';
import { useBluetooth } from './useBluetooth';
import { 
  ELM_COMMANDS, 
  STANDARD_PIDS,
  createDecodedECUConnector,
  createRawECUConnector,
  ECUConnector
} from '../utils/obdUtils';

/**
 * Hook for working with ECU commands
 * Provides functions for common OBD operations
 */
export const useECUCommands = () => {
  const { sendCommand, isConnected } = useBluetooth();

  /**
   * Initialize the OBD connection with common setup commands
   */
  const initializeOBD = useCallback(async () => {
    if (!isConnected) return false;

    try {
      // Reset the adapter
      await sendCommand(ELM_COMMANDS.RESET);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Configure the adapter
      await sendCommand(ELM_COMMANDS.ECHO_OFF);
      await sendCommand(ELM_COMMANDS.LINEFEEDS_OFF);
      await sendCommand(ELM_COMMANDS.HEADERS_OFF);
      await sendCommand(ELM_COMMANDS.SPACES_OFF);
      
      // Set automatic protocol detection
      await sendCommand(ELM_COMMANDS.AUTO_PROTOCOL);

      // Set adaptive timing
      await sendCommand(ELM_COMMANDS.ADAPTIVE_TIMING_2);

      return true;
    } catch (error) {
      console.error('OBD initialization failed:', error);
      return false;
    }
  }, [isConnected, sendCommand]);

  /**
   * Get vehicle identification number
   */
  const getVIN = useCallback(async () => {
    if (!isConnected) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.VIN);
      return response;
    } catch (error) {
      console.error('Failed to get VIN:', error);
      return null;
    }
  }, [isConnected, sendCommand]);

  /**
   * Get current engine RPM
   */
  const getEngineRPM = useCallback(async () => {
    if (!isConnected) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.ENGINE_RPM);
      // Would need to convert the response to actual RPM value
      return response;
    } catch (error) {
      console.error('Failed to get RPM:', error);
      return null;
    }
  }, [isConnected, sendCommand]);

  /**
   * Get current vehicle speed in km/h
   */
  const getVehicleSpeed = useCallback(async () => {
    if (!isConnected) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.VEHICLE_SPEED);
      return response;
    } catch (error) {
      console.error('Failed to get speed:', error);
      return null;
    }
  }, [isConnected, sendCommand]);

  /**
   * Get current engine coolant temperature
   */
  const getEngineCoolantTemp = useCallback(async () => {
    if (!isConnected) return null;
    try {
      const response = await sendCommand(STANDARD_PIDS.ENGINE_COOLANT_TEMP);
      return response;
    } catch (error) {
      console.error('Failed to get coolant temp:', error);
      return null;
    }
  }, [isConnected, sendCommand]);

  /**
   * Get battery voltage
   */
  const getBatteryVoltage = useCallback(async () => {
    if (!isConnected) return null;
    try {
      const response = await sendCommand(ELM_COMMANDS.READ_VOLTAGE);
      return response;
    } catch (error) {
      console.error('Failed to get battery voltage:', error);
      return null;
    }
  }, [isConnected, sendCommand]);

  /**
   * Get diagnostic trouble codes (DTCs)
   */
  const getTroubleCodes = useCallback(async () => {
    if (!isConnected) return null;
    try {
      // Mode 03 retrieves confirmed DTCs
      const response = await sendCommand('03');
      return response;
    } catch (error) {
      console.error('Failed to get trouble codes:', error);
      return null;
    }
  }, [isConnected, sendCommand]);

  /**
   * Clear diagnostic trouble codes
   */
  const clearTroubleCodes = useCallback(async () => {
    if (!isConnected) return false;
    try {
      // Mode 04 clears DTCs
      await sendCommand('04');
      return true;
    } catch (error) {
      console.error('Failed to clear trouble codes:', error);
      return false;
    }
  }, [isConnected, sendCommand]);

  /**
   * Create raw data connector for custom implementations
   */
  const getRawConnector = useCallback((): ECUConnector | null => {
    if (!isConnected || !sendCommand) return null;
    return createRawECUConnector(sendCommand);
  }, [isConnected, sendCommand]);

  /**
   * Create decoded data connector for custom implementations
   */
  const getDecodedConnector = useCallback((): ECUConnector | null => {
    if (!isConnected || !sendCommand) return null;
    return createDecodedECUConnector(sendCommand);
  }, [isConnected, sendCommand]);

  return {
    initializeOBD,
    getVIN,
    getEngineRPM,
    getVehicleSpeed,
    getEngineCoolantTemp,
    getBatteryVoltage,
    getTroubleCodes,
    clearTroubleCodes,
    getRawConnector,
    getDecodedConnector,
  };
};
