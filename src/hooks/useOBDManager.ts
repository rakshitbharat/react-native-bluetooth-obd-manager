import { useState, useEffect, useCallback } from 'react';
import OBDManager, { ConnectionState, OBDEventType, OBDProtocol } from '../managers/OBDManager';
import { useBluetooth } from './useBluetooth';
import { useECUCommands } from './useECUCommands';

interface OBDManagerState {
  connectionState: ConnectionState;
  protocol: OBDProtocol;
  protocolName: string;
  error: string | null;
  isInitializing: boolean;
}

/**
 * Hook for interacting with the OBD Manager
 */
export const useOBDManager = () => {
  const [state, setState] = useState<OBDManagerState>({
    connectionState: OBDManager.getConnectionState(),
    protocol: OBDManager.getProtocol(),
    protocolName: OBDManager.getProtocolName(),
    error: null,
    isInitializing: false,
  });
  
  const { isConnected } = useBluetooth();
  const { getDecodedConnector } = useECUCommands();
  
  // Initialize OBD Manager with current ECU connector
  const initialize = useCallback(async () => {
    if (!isConnected) {
      setState(current => ({
        ...current,
        error: 'No device connected',
      }));
      return false;
    }
    
    try {
      setState(current => ({
        ...current,
        isInitializing: true,
        error: null,
      }));
      
      // Get the connector from the ECU commands hook
      const connector = getDecodedConnector();
      
      if (!connector) {
        throw new Error('Failed to get ECU connector');
      }
      
      // Set the connector in the OBD Manager
      OBDManager.setECUConnector(connector);
      
      // Initialize OBD communication
      const success = await OBDManager.initialize();
      
      setState(current => ({
        ...current,
        isInitializing: false,
        connectionState: OBDManager.getConnectionState(),
        protocol: OBDManager.getProtocol(),
        protocolName: OBDManager.getProtocolName(),
        error: success ? null : 'Initialization failed',
      }));
      
      return success;
    } catch (error) {
      setState(current => ({
        ...current,
        isInitializing: false,
        error: (error as Error).message,
      }));
      return false;
    }
  }, [isConnected, getDecodedConnector]);
  
  // Register for OBD events
  useEffect(() => {
    const handleEvent = (event: OBDEventType, data?: any) => {
      switch (event) {
        case OBDEventType.CONNECTED:
          setState(current => ({
            ...current,
            connectionState: ConnectionState.CONNECTED,
            error: null,
          }));
          break;
          
        case OBDEventType.DISCONNECTED:
          setState(current => ({
            ...current,
            connectionState: ConnectionState.DISCONNECTED,
          }));
          break;
          
        case OBDEventType.PROTOCOL_DETECTED:
          setState(current => ({
            ...current,
            protocol: OBDManager.getProtocol(),
            protocolName: OBDManager.getProtocolName(),
          }));
          break;
          
        case OBDEventType.ERROR:
          setState(current => ({
            ...current,
            error: data?.message || 'Unknown error',
          }));
          break;
      }
    };
    
    // Register event listener
    OBDManager.addEventListener(handleEvent);
    
    // Clean up on unmount
    return () => {
      OBDManager.removeEventListener(handleEvent);
    };
  }, []);
  
  // Monitor Bluetooth connectivity
  useEffect(() => {
    if (!isConnected && state.connectionState !== ConnectionState.DISCONNECTED) {
      // Bluetooth disconnected, update OBD state
      OBDManager.disconnect();
      setState(current => ({
        ...current,
        connectionState: ConnectionState.DISCONNECTED,
      }));
    }
  }, [isConnected, state.connectionState]);
  
  /**
   * Send a custom command to the OBD device
   */
  const sendCommand = useCallback(async (command: string) => {
    if (!OBDManager.isConnected()) {
      throw new Error('Not connected to OBD device');
    }
    
    try {
      return await OBDManager.sendCommand(command);
    } catch (error) {
      setState(current => ({
        ...current,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, []);
  
  /**
   * Request a standard PID
   */
  const requestPid = useCallback(async (mode: number, pid: number) => {
    if (!OBDManager.isConnected()) {
      throw new Error('Not connected to OBD device');
    }
    
    try {
      return await OBDManager.requestPid(mode, pid);
    } catch (error) {
      setState(current => ({
        ...current,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, []);
  
  return {
    ...state,
    initialize,
    sendCommand,
    requestPid,
    isInitialized: OBDManager.isConnected(),
  };
};
