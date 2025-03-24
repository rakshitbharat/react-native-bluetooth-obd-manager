import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { useOBDManager } from '../hooks/useOBDManager';
import { BluetoothDeviceInfo } from '../types/bluetoothTypes';
import { logBluetoothError, logOBDDataError } from '../utils/errorUtils';

/**
 * OBD Live Data Example
 *
 * This component demonstrates how to use the OBD Manager to:
 * 1. Scan for and connect to OBD devices
 * 2. Initialize the OBD interface
 * 3. Fetch live vehicle data
 * 4. Read diagnostic trouble codes
 */
const OBDLiveDataComponent = () => {
  // Set up state for the UI
  const [scanning, setScanning] = useState(false);
  const [liveData, setLiveData] = useState<{
    rpm?: number;
    speed?: number;
    coolantTemp?: number;
    throttlePosition?: number;
    batteryVoltage?: number;
  }>({});
  const [troubleCodes, setTroubleCodes] = useState<string[]>([]);
  const [dataPolling, setDataPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Initialize the OBD Manager
  const obd = useOBDManager({
    autoInit: true,
    connectToLast: true,
    onConnected: deviceId => {
      logOBDDataError(`Connected to device: ${deviceId}`);
    },
    onDisconnected: () => {
      logOBDDataError('Disconnected from device');
      // Stop polling when disconnected
      stopPolling();
    },
    onError: error => {
      logBluetoothError(error, 'OBDLiveData');
    },
  });

  // Scan for OBD devices
  const startScan = async () => {
    setScanning(true);
    await obd.scanForDevices(5000); // Scan for 5 seconds
    setScanning(false);
  };

  // Connect to a device
  const connectToDevice = async (deviceId: string) => {
    await obd.connectToDevice(deviceId);
  };

  // Start polling for live data
  const startPolling = () => {
    if (dataPolling) return;

    setDataPolling(true);

    // Poll for data every second
    const interval = setInterval(async () => {
      if (!obd.isConnected) {
        stopPolling();
        return;
      }

      try {
        // Get live data
        const data = await obd.getLiveData();

        // Get battery voltage (less frequently to avoid overloading)
        if (Math.random() > 0.7) {
          const voltage = await obd.getBatteryVoltage();
          setLiveData(prev => ({ ...prev, ...data, batteryVoltage: voltage || undefined }));
        } else {
          setLiveData(prev => ({ ...prev, ...data }));
        }
      } catch (error) {
        console.warn('Error polling data:', error);
      }
    }, 1000);

    setPollingInterval(interval);
  };

  // Move stopPolling into useCallback
  const stopPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setDataPolling(false);
  }, [pollingInterval]);

  // Read trouble codes
  const readTroubleCodes = async () => {
    try {
      const codes = await obd.getDiagnosticCodes();
      setTroubleCodes(codes);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error reading trouble codes');
      logOBDDataError('Error reading trouble codes:', err);
    }
  };

  // Clear trouble codes
  const clearTroubleCodes = async () => {
    try {
      await obd.clearDiagnosticCodes();
      setTroubleCodes([]);
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('Unknown error clearing trouble codes');
      logOBDDataError('Error clearing trouble codes:', err);
    }
  };

  // The useEffect cleanup will now use the memoized stopPolling
  useEffect(() => {
    return () => {
      if (obd.isConnected) {
        stopPolling();
        obd.disconnect();
      }
    };
  }, [obd, stopPolling]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>OBD-II Live Data</Text>

      {/* Connection Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Status</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text
            style={[
              styles.statusValue,
              obd.isConnected ? styles.statusConnected : styles.statusDisconnected,
            ]}
          >
            {obd.status.toUpperCase()}
          </Text>
        </View>

        {obd.connectedDevice && (
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{obd.connectedDevice.name || 'Unknown Device'}</Text>
            <Text style={styles.deviceId}>{obd.connectedDevice.id}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, scanning && styles.buttonDisabled]}
            onPress={startScan}
            disabled={scanning || dataPolling}
          >
            <Text style={styles.buttonText}>{scanning ? 'Scanning...' : 'Scan for Devices'}</Text>
          </TouchableOpacity>

          {obd.isConnected ? (
            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={() => obd.disconnect()}
              disabled={dataPolling}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {dataPolling ? (
          <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopPolling}>
            <Text style={styles.buttonText}>Stop Data Polling</Text>
          </TouchableOpacity>
        ) : (
          obd.isConnected && (
            <TouchableOpacity style={[styles.button, styles.startButton]} onPress={startPolling}>
              <Text style={styles.buttonText}>Start Data Polling</Text>
            </TouchableOpacity>
          )
        )}

        {obd.isConnected && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.button}
              onPress={readTroubleCodes}
              disabled={dataPolling}
            >
              <Text style={styles.buttonText}>Read DTCs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, troubleCodes.length === 0 && styles.buttonDisabled]}
              onPress={clearTroubleCodes}
              disabled={troubleCodes.length === 0 || dataPolling}
            >
              <Text style={styles.buttonText}>Clear DTCs</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Available Devices */}
      {!obd.isConnected &&
        obd.bluetooth.discoveredDevices &&
        obd.bluetooth.discoveredDevices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Devices</Text>
            <FlatList
              data={obd.bluetooth.discoveredDevices}
              keyExtractor={(item: BluetoothDeviceInfo) => item.id}
              renderItem={({ item }: { item: BluetoothDeviceInfo }) => (
                <TouchableOpacity
                  style={styles.deviceItem}
                  onPress={() => connectToDevice(item.id)}
                >
                  <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
                  <Text style={styles.deviceId}>{item.id}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

      {/* Live Data Display */}
      {obd.isConnected && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Data</Text>

          {dataPolling && !liveData.rpm && !liveData.speed && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.loadingText}>Waiting for data...</Text>
            </View>
          )}

          <View style={styles.dataGrid}>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>RPM</Text>
              <Text style={styles.dataValue}>
                {liveData.rpm !== undefined ? `${Math.round(liveData.rpm)}` : '-'}
              </Text>
            </View>

            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Speed</Text>
              <Text style={styles.dataValue}>
                {liveData.speed !== undefined ? `${liveData.speed} km/h` : '-'}
              </Text>
            </View>

            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Coolant</Text>
              <Text style={styles.dataValue}>
                {liveData.coolantTemp !== undefined ? `${liveData.coolantTemp}°C` : '-'}
              </Text>
            </View>

            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Throttle</Text>
              <Text style={styles.dataValue}>
                {liveData.throttlePosition !== undefined
                  ? `${Math.round(liveData.throttlePosition)}%`
                  : '-'}
              </Text>
            </View>

            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Battery</Text>
              <Text style={styles.dataValue}>
                {liveData.batteryVoltage !== undefined
                  ? `${liveData.batteryVoltage.toFixed(1)}V`
                  : '-'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Trouble Codes */}
      {obd.isConnected && troubleCodes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trouble Codes</Text>
          {troubleCodes.map((code, index) => (
            <View key={index} style={styles.codeItem}>
              <Text style={styles.codeText}>{code}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Protocol Info */}
      {obd.isConnected && obd.obdProtocol && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Protocol Information</Text>
          <Text style={styles.protocolText}>Protocol: {obd.obdProtocol}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#444',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    marginRight: 8,
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusConnected: {
    color: 'green',
  },
  statusDisconnected: {
    color: 'red',
  },
  deviceInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  deviceId: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  buttonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  deviceList: {
    maxHeight: 200,
  },
  deviceItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dataItem: {
    width: '48%',
    backgroundColor: '#F9F9F9',
    padding: 12,
    marginBottom: 8,
    borderRadius: 4,
  },
  dataLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  codeItem: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    marginBottom: 8,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  codeText: {
    fontSize: 16,
    color: '#D32F2F',
    fontWeight: 'bold',
  },
  protocolText: {
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
  },
});

export const OBDLiveData = OBDLiveDataComponent;
