import { BluetoothProvider, useBluetooth } from './context/BluetoothContext';
import { ConnectionDetails } from './types/bluetoothTypes';
import { useECUCommands } from './hooks/useECUCommands';
import { useDeviceDetection } from './hooks/useDeviceDetection';
import { useOBDManager } from './hooks/useOBDManager';
import { 
  ELM_COMMANDS, 
  STANDARD_PIDS, 
  OBD_SERVICE_MODES,
  createRawECUConnector,
  createDecodedECUConnector
} from './utils/obdUtils';
import OBDManager, { ConnectionState, OBDEventType, OBDProtocol } from './managers/OBDManager';
import DeviceManager from './managers/DeviceManager';
import { parseEngineRPM, parseVehicleSpeed, parseEngineCoolantTemp, parseThrottlePosition, parseDTCResponse } from './utils/obdDataUtils';

// Export main components
export { 
  // Core components
  BluetoothProvider, 
  useBluetooth,
  ConnectionDetails,
  
  // Hooks
  useECUCommands,
  useDeviceDetection,
  useOBDManager,
  
  // Managers
  OBDManager,
  DeviceManager,
  
  // Manager types
  ConnectionState,
  OBDEventType,
  OBDProtocol,
  
  // Utilities
  ELM_COMMANDS,
  STANDARD_PIDS,
  OBD_SERVICE_MODES,
  createRawECUConnector,
  createDecodedECUConnector,
  
  // Data parsing utilities
  parseEngineRPM,
  parseVehicleSpeed,
  parseEngineCoolantTemp,
  parseThrottlePosition,
  parseDTCResponse
};

export default BluetoothProvider;
