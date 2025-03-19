import { useEffect, useState, useCallback } from 'react';
import { useBluetooth } from './useBluetooth';
import { BluetoothDeviceInfo } from '../types/bluetoothTypes';

/**
 * Keywords commonly found in OBD device names
 */
const OBD_KEYWORDS = [
  'obd',
  'elm',
  'elm327',
  'obdii',
  'eobd',
  'car',
  'scanner',
  'vgate',
  'interface',
];

/**
 * Check if a device is likely an OBD device based on name
 */
const isOBDCompatibleDevice = (device: BluetoothDeviceInfo): boolean => {
  if (!device.name) return false;

  const deviceNameLower = device.name.toLowerCase();
  return OBD_KEYWORDS.some(keyword => deviceNameLower.includes(keyword));
};

/**
 * Custom hook for detecting OBD-compatible devices
 */
export const useDeviceDetection = () => {
  const { scanDevices, discoveredDevices, isScanning } = useBluetooth();
  const [obdDevices, setObdDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDeviceInfo | null>(null);
  const [autoConnectDevice, setAutoConnectDevice] = useState<string | null>(null);

  /**
   * Filter discovered devices for OBD-compatible ones
   */
  useEffect(() => {
    if (!discoveredDevices) return;

    const filteredDevices = discoveredDevices.filter(isOBDCompatibleDevice);
    setObdDevices(filteredDevices);

    // If we have an auto-connect device, try to find it
    if (autoConnectDevice && !selectedDevice) {
      const deviceToConnect = filteredDevices.find(
        (d: BluetoothDeviceInfo) => d.id === autoConnectDevice,
      );
      if (deviceToConnect) {
        setSelectedDevice(deviceToConnect);
      }
    }

    // Automatically select a device if only one OBD device is found
    if (filteredDevices.length === 1 && !selectedDevice && !autoConnectDevice) {
      setSelectedDevice(filteredDevices[0]);
    }
  }, [discoveredDevices, autoConnectDevice, selectedDevice]);

  /**
   * Start automatic device scan with timeout
   */
  const startDeviceScan = useCallback(
    async (timeoutMs = 5000, autoConnectId?: string) => {
      // If auto-connect ID is provided, set it for later use
      if (autoConnectId) {
        setAutoConnectDevice(autoConnectId);
      }

      // Clear previous OBD devices
      setObdDevices([]);

      // Start scan
      return scanDevices(timeoutMs);
    },
    [scanDevices],
  );

  /**
   * Reset device selection
   */
  const resetSelection = useCallback(() => {
    setSelectedDevice(null);
    setAutoConnectDevice(null);
  }, []);

  return {
    startDeviceScan,
    isScanning,
    obdDevices,
    selectedDevice,
    setSelectedDevice,
    resetSelection,
    allDevices: discoveredDevices || [],
  };
};
