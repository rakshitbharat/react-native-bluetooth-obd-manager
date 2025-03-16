import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';

export const MinimalOBDExample: React.FC = () => {
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
    requestPermissions
  } = useBluetooth();

  const [loading, setLoading] = useState(false);

  // Initialize and connect to device
  const handleConnect = async (deviceId: string) => {
    try {
      setLoading(true);
      
      // Connect to device
      const connected = await connectToDevice(deviceId);
      if (!connected) {
        Alert.alert('Error', 'Failed to connect to device');
        return;
      }

      // Initialize with basic AT commands
      await sendCommand('ATZ'); // Reset
      await sendCommand('ATE0'); // Echo off
      await sendCommand('ATL0'); // Linefeeds off
      
      Alert.alert('Success', 'Connected and initialized');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Disconnect from device
  const handleDisconnect = async () => {
    if (!connectedDevice) return;
    
    try {
      setLoading(true);
      await disconnect(connectedDevice.id);
      Alert.alert('Success', 'Disconnected');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Start scanning
  const handleScan = async () => {
    if (!isBluetoothOn) {
      Alert.alert('Error', 'Bluetooth is not enabled');
      return;
    }

    if (!hasPermissions) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Error', 'Bluetooth permissions required');
        return;
      }
    }

    try {
      await scanDevices(5000); // Scan for 5 seconds
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  // Send a test command
  const handleTestCommand = async () => {
    if (!connectedDevice) {
      Alert.alert('Error', 'No device connected');
      return;
    }

    try {
      setLoading(true);
      const response = await sendCommand('0100'); // Request supported PIDs
      Alert.alert('Response', response);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.status}>
        <Text>Bluetooth: {isBluetoothOn ? 'On' : 'Off'}</Text>
        <Text>Permissions: {hasPermissions ? 'Granted' : 'Not Granted'}</Text>
        <Text>Connected: {connectedDevice ? 'Yes' : 'No'}</Text>
      </View>

      <TouchableOpacity 
        style={[styles.button, isScanning && styles.buttonDisabled]}
        onPress={handleScan}
        disabled={isScanning || loading}
      >
        <Text style={styles.buttonText}>
          {isScanning ? 'Scanning...' : 'Scan for Devices'}
        </Text>
      </TouchableOpacity>

      {discoveredDevices.length > 0 && (
        <View style={styles.devices}>
          <Text style={styles.header}>Found Devices:</Text>
          {discoveredDevices.map(device => (
            <TouchableOpacity
              key={device.id}
              style={styles.device}
              onPress={() => handleConnect(device.id)}
              disabled={loading}
            >
              <Text>{device.name || 'Unknown Device'}</Text>
              <Text style={styles.deviceId}>{device.id}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {connectedDevice && (
        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.button}
            onPress={handleTestCommand}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Test Command</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.disconnectButton]}
            onPress={handleDisconnect}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={styles.loading}>
          <Text>Processing...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  status: {
    marginBottom: 16,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  devices: {
    marginTop: 16,
  },
  header: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  device: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
  },
  controls: {
    marginTop: 16,
  },
  disconnectButton: {
    backgroundColor: '#f44336',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});