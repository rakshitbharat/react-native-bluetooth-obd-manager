import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';

import { useBluetooth } from '../context/BluetoothContext';
import { ELM_COMMANDS } from '../utils/obdUtils';

interface DeviceItemProps {
  name: string;
  id: string;
  rssi?: number;
  onPress: () => void;
}

const DeviceItem: React.FC<DeviceItemProps> = ({ name, id, rssi, onPress }) => (
  <TouchableOpacity style={styles.deviceItem} onPress={onPress}>
    <View>
      <Text style={styles.deviceName}>{name || 'Unknown Device'}</Text>
      <Text style={styles.deviceId}>{id}</Text>
    </View>
    {rssi && <Text style={styles.rssi}>{rssi} dBm</Text>}
  </TouchableOpacity>
);

export const OBDDeviceScanner: React.FC = () => {
  const {
    isBluetoothOn,
    hasPermissions,
    isScanning,
    discoveredDevices,
    connectedDevice,
    scanDevices,
    connectToDevice,
    disconnect,
    sendCommand,
    requestPermissions,
  } = useBluetooth();

  const [initializingDevice, setInitializingDevice] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<string>('');

  // Request permissions on mount if needed
  useEffect(() => {
    if (!hasPermissions) {
      requestPermissions();
    }
  }, [hasPermissions]);

  // Start a device scan
  const handleStartScan = async () => {
    if (!isBluetoothOn) {
      setDeviceInfo('Please turn on Bluetooth');
      return;
    }
    if (!hasPermissions) {
      setDeviceInfo('Bluetooth permissions required');
      return;
    }
    await scanDevices(5000); // Scan for 5 seconds
  };

  // Connect to a device and initialize it
  const handleDevicePress = async (deviceId: string) => {
    try {
      setInitializingDevice(true);
      setDeviceInfo('Connecting...');

      const connected = await connectToDevice(deviceId);
      if (!connected) {
        setDeviceInfo('Failed to connect');
        return;
      }

      setDeviceInfo('Connected. Initializing OBD...');

      // Initialize the OBD device
      try {
        // Reset the device
        await sendCommand(ELM_COMMANDS.RESET);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Turn off echo
        await sendCommand(ELM_COMMANDS.ECHO_OFF);
        
        // Turn off line feeds
        await sendCommand(ELM_COMMANDS.LINEFEEDS_OFF);
        
        // Get device info
        const version = await sendCommand(ELM_COMMANDS.GET_VERSION);
        setDeviceInfo(`Connected: ${version}`);
      } catch (error) {
        console.error('Error initializing device:', error);
        setDeviceInfo('Error initializing device');
        await disconnect(deviceId);
      }
    } catch (error) {
      console.error('Error connecting to device:', error);
      setDeviceInfo('Connection failed');
    } finally {
      setInitializingDevice(false);
    }
  };

  // Disconnect from current device
  const handleDisconnect = async () => {
    if (connectedDevice) {
      await disconnect(connectedDevice.id);
      setDeviceInfo('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OBD Device Scanner</Text>
        <Text style={styles.status}>
          Bluetooth: {isBluetoothOn ? 'On' : 'Off'} • 
          Permissions: {hasPermissions ? 'Granted' : 'Not Granted'}
        </Text>
      </View>

      <View style={styles.controls}>
        {!connectedDevice ? (
          <TouchableOpacity 
            style={[styles.button, isScanning && styles.buttonDisabled]} 
            onPress={handleStartScan}
            disabled={isScanning}
          >
            <Text style={styles.buttonText}>
              {isScanning ? 'Scanning...' : 'Scan for Devices'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleDisconnect}
          >
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      {deviceInfo ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{deviceInfo}</Text>
          {initializingDevice && <ActivityIndicator style={styles.spinner} />}
        </View>
      ) : null}

      <FlatList
        data={discoveredDevices}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DeviceItem
            name={item.name}
            id={item.id}
            rssi={item.rssi}
            onPress={() => handleDevicePress(item.id)}
          />
        )}
        style={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  status: {
    fontSize: 14,
    color: '#666',
  },
  controls: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    flex: 1,
  },
  buttonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
  },
  rssi: {
    fontSize: 12,
    color: '#2196F3',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    color: '#1976D2',
  },
  spinner: {
    marginLeft: 8,
  },
});
