import { useState, useEffect, useCallback, useRef } from 'react';

import { useOBDManager } from './useOBDManager';
import { parseEngineRPM, parseVehicleSpeed, parseEngineCoolantTemp, parseThrottlePosition } from '../utils/obdDataUtils';
import { STANDARD_PIDS } from '../utils/obdUtils';

export interface MonitoredData {
  rpm: number | null;
  speed: number | null;
  coolantTemp: number | null;
  throttlePosition: number | null;
  lastUpdated: Record<string, number>;
}

interface MonitoringOptions {
  refreshRate?: number; // ms between refreshes
  enabledPids?: string[]; // PIDs to monitor (all by default)
}

const DEFAULT_REFRESH_RATE = 1000; // 1 second
const DEFAULT_PIDS = [
  'rpm',
  'speed',
  'coolantTemp',
  'throttlePosition',
];

/**
 * Hook for real-time monitoring of OBD data
 */
export const useOBDMonitoring = (options: MonitoringOptions = {}) => {
  const { refreshRate = DEFAULT_REFRESH_RATE, enabledPids = DEFAULT_PIDS } = options;
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [data, setData] = useState<MonitoredData>({
    rpm: null,
    speed: null,
    coolantTemp: null,
    throttlePosition: null,
    lastUpdated: {} 
  });
  
  const { isInitialized, sendCommand } = useOBDManager();
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const monitoringShouldStop = useRef(false);
  
  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!isInitialized) {
      console.error('Cannot start monitoring - OBD not initialized');
      return false;
    }
    
    if (isMonitoring) {
      console.warn('Monitoring is already active');
      return true;
    }
    
    monitoringShouldStop.current = false;
    setIsMonitoring(true);
    
    // Start the monitoring loop
    const monitoringLoop = async () => {
      if (monitoringShouldStop.current) {
        setIsMonitoring(false);
        return;
      }
      
      try {
        // Request each PID if enabled
        if (enabledPids.includes('rpm')) {
          const rpmResponse = await sendCommand(STANDARD_PIDS.ENGINE_RPM);
          const rpm = parseEngineRPM(rpmResponse);
          
          setData(prev => ({
            ...prev,
            rpm,
            lastUpdated: { ...prev.lastUpdated, rpm: Date.now() }
          }));
        }
        
        if (enabledPids.includes('speed')) {
          const speedResponse = await sendCommand(STANDARD_PIDS.VEHICLE_SPEED);
          const speed = parseVehicleSpeed(speedResponse);
          
          setData(prev => ({
            ...prev,
            speed,
            lastUpdated: { ...prev.lastUpdated, speed: Date.now() }
          }));
        }
        
        if (enabledPids.includes('coolantTemp')) {
          const tempResponse = await sendCommand(STANDARD_PIDS.ENGINE_COOLANT_TEMP);
          const temp = parseEngineCoolantTemp(tempResponse);
          
          setData(prev => ({
            ...prev,
            coolantTemp: temp,
            lastUpdated: { ...prev.lastUpdated, coolantTemp: Date.now() }
          }));
        }
        
        if (enabledPids.includes('throttlePosition')) {
          const throttleResponse = await sendCommand(STANDARD_PIDS.THROTTLE_POS);
          const throttle = parseThrottlePosition(throttleResponse);
          
          setData(prev => ({
            ...prev,
            throttlePosition: throttle,
            lastUpdated: { ...prev.lastUpdated, throttlePosition: Date.now() }
          }));
        }
        
        // Schedule next update if still monitoring
        if (!monitoringShouldStop.current) {
          monitoringIntervalRef.current = setTimeout(monitoringLoop, refreshRate);
        }
      } catch (error) {
        console.error('Error during OBD monitoring:', error);
        stopMonitoring();
      }
    };
    
    // Start the loop
    monitoringLoop();
    return true;
  }, [isInitialized, isMonitoring, enabledPids, refreshRate, sendCommand]);
  
  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    monitoringShouldStop.current = true;
    
    if (monitoringIntervalRef.current) {
      clearTimeout(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    
    setIsMonitoring(false);
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearTimeout(monitoringIntervalRef.current);
      }
    };
  }, []);
  
  return {
    data,
    isMonitoring,
    startMonitoring,
    stopMonitoring
  };
};
