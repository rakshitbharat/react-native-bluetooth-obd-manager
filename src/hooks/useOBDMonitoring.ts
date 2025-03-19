import { useState, useEffect, useCallback, useRef } from 'react';

import { useOBDManager } from './useOBDManager';
import { BluetoothOBDError } from '../utils/errorUtils';
import {
  parseEngineRPM,
  parseVehicleSpeed,
  parseEngineCoolantTemp,
  parseThrottlePosition,
} from '../utils/obdDataUtils';
import { STANDARD_PIDS } from '../utils/obdUtils';

export type MonitoredValue = number | null;

export interface MonitoredData {
  rpm: MonitoredValue;
  speed: MonitoredValue;
  coolantTemp: MonitoredValue;
  throttlePosition: MonitoredValue;
  lastUpdated: Record<string, number>;
}

export interface MonitoringOptions {
  refreshRate?: number; // ms between refreshes
  enabledPids?: Array<keyof Omit<MonitoredData, 'lastUpdated'>>; // PIDs to monitor (all by default)
}

const DEFAULT_REFRESH_RATE = 1000; // 1 second
const DEFAULT_PIDS: Array<keyof Omit<MonitoredData, 'lastUpdated'>> = [
  'rpm',
  'speed',
  'coolantTemp',
  'throttlePosition',
];

const INITIAL_DATA: MonitoredData = {
  rpm: null,
  speed: null,
  coolantTemp: null,
  throttlePosition: null,
  lastUpdated: {},
};

/**
 * Hook for real-time monitoring of OBD data
 * @param options Configuration options for monitoring
 * @returns Monitoring state and control functions
 */
export const useOBDMonitoring = (
  options: MonitoringOptions = {},
): {
  data: MonitoredData;
  isMonitoring: boolean;
  startMonitoring: () => boolean;
  stopMonitoring: () => void;
} => {
  const { refreshRate = DEFAULT_REFRESH_RATE, enabledPids = DEFAULT_PIDS } = options;

  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [data, setData] = useState<MonitoredData>(INITIAL_DATA);

  const { isInitialized, sendCommand } = useOBDManager();
  const monitoringIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monitoringShouldStop = useRef<boolean>(false);

  // Stop monitoring
  const stopMonitoring = useCallback((): void => {
    monitoringShouldStop.current = true;

    if (monitoringIntervalRef.current) {
      clearTimeout(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }

    setIsMonitoring(false);
  }, []);

  // Start monitoring
  const startMonitoring = useCallback((): boolean => {
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
    const monitoringLoop = async (): Promise<void> => {
      if (monitoringShouldStop.current) {
        setIsMonitoring(false);
        return;
      }

      try {
        // Request each PID if enabled
        const updatePromises: Promise<void>[] = [];

        if (enabledPids.includes('rpm')) {
          updatePromises.push(
            sendCommand(STANDARD_PIDS.ENGINE_RPM).then(rpmResponse => {
              const rpm = parseEngineRPM(rpmResponse);
              setData(prev => ({
                ...prev,
                rpm,
                lastUpdated: { ...prev.lastUpdated, rpm: Date.now() },
              }));
            }),
          );
        }

        if (enabledPids.includes('speed')) {
          updatePromises.push(
            sendCommand(STANDARD_PIDS.VEHICLE_SPEED).then(speedResponse => {
              const speed = parseVehicleSpeed(speedResponse);
              setData(prev => ({
                ...prev,
                speed,
                lastUpdated: { ...prev.lastUpdated, speed: Date.now() },
              }));
            }),
          );
        }

        if (enabledPids.includes('coolantTemp')) {
          updatePromises.push(
            sendCommand(STANDARD_PIDS.ENGINE_COOLANT_TEMP).then(tempResponse => {
              const temp = parseEngineCoolantTemp(tempResponse);
              setData(prev => ({
                ...prev,
                coolantTemp: temp,
                lastUpdated: { ...prev.lastUpdated, coolantTemp: Date.now() },
              }));
            }),
          );
        }

        if (enabledPids.includes('throttlePosition')) {
          updatePromises.push(
            sendCommand(STANDARD_PIDS.THROTTLE_POSITION).then(throttleResponse => {
              const throttle = parseThrottlePosition(throttleResponse);
              setData(prev => ({
                ...prev,
                throttlePosition: throttle,
                lastUpdated: { ...prev.lastUpdated, throttlePosition: Date.now() },
              }));
            }),
          );
        }

        // Wait for all updates to complete
        await Promise.all(updatePromises);

        // Schedule next update if still monitoring
        if (!monitoringShouldStop.current) {
          monitoringIntervalRef.current = setTimeout(monitoringLoop, refreshRate);
        }
      } catch (error) {
        console.error(
          'Error during OBD monitoring:',
          error instanceof BluetoothOBDError ? error.message : error,
        );
        stopMonitoring();
      }
    };

    // Start the loop
    void monitoringLoop();
    return true;
  }, [isInitialized, isMonitoring, enabledPids, refreshRate, sendCommand, stopMonitoring]);

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
    stopMonitoring,
  };
};
