import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useBluetooth } from '../hooks/useBluetooth';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import { useECUCommands } from '../hooks/useECUCommands';
import { Peripheral } from 'react-native-ble-manager';
import { STANDARD_PIDS } from '../utils/obdUtils';

const OBDDeviceScanner: React.FC = () => {
  const [vehicleData, setVehicleData] = useState<Record<string, string>>({});
  
  // Get Bluetooth state and functions
  const {
    isBluetoothOn,
    hasPermissions,
    isConnected,
    connectedDevice,
    requestPermissions,
    disconnect,
    connectToDevice
  } = useBluetooth();

  // Use device detection hook
  const {
    startDeviceScan,
    isScanning,
    obdDevices,
    selectedDevice,
    setSelectedDevice
  } = useDeviceDetection();

  // Get ECU commands
  const {
    initializeOBD,
    getVIN,
    getEngineRPM,
    getVehicleSpeed,
    getEngineCoolantTemp,
    getBatteryVoltage
  } = useECUCommands();

  // Handle scan button press
  const handleScan = async () => {
    if (!isBluetoothOn) {
      alert('Please turn on Bluetooth');
      return;
    }

    if (!hasPermissions) {
      const granted = await requestPermissions();
      if (!granted) {
        alert('Bluetooth permissions are required');
        return;
      }
    }

    await startDeviceScan(10000); // 10 second scan
  };

  // Handle device selection
  const selectDevice = (device: Peripheral) => {
    setSelectedDevice(device);
  };

  // Handle device connection
  const handleConnect = async () => {
    if (!selectedDevice) return;
    
    try {
      // Fixed: Use the connectToDevice function directly from the hook
      const success = await connectToDevice(selectedDevice.id);
      
      if (success) {
        // Initialize OBD communication
        await initializeOBD();
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect to device');
    }
  };

  // Handle device disconnection
  const handleDisconnect = async () => {
    if (!connectedDevice) return;
    await disconnect(connectedDevice.id);
  };

  // Fetch basic vehicle data
  const fetchVehicleData = async () => {
    if (!isConnected) return;
    
    setVehicleData({ status: 'Loading...' });
    
    try {
      const results: Record<string, string> = {};
      
      // Get VIN
      const vin = await getVIN();
      results.vin = vin || 'Not available';
      
      // Get battery voltage
      const batteryVoltage = await getBatteryVoltage();
      results.batteryVoltage = batteryVoltage || 'Not available';
      
      // Get engine RPM if engine is running
      const rpm = await getEngineRPM();
      results.rpm = rpm || 'Not available';
      
      // Get vehicle speed
      const speed = await getVehicleSpeed();
      results.speed = speed || 'Not available';
      
      // Get coolant temperature
      const coolantTemp = await getEngineCoolantTemp();
      results.coolantTemp = coolantTemp || 'Not available';
      
      setVehicleData(results);
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      setVehicleData({ error: 'Failed to fetch data' });
    }
  };

  // Render device item
  const renderDeviceItem = ({ item }: { item: Peripheral }) => {
    const isSelected = selectedDevice?.id === item.id;
    
    return (
      <TouchableOpacity 
        style={[styles.deviceItem, isSelected && styles.selectedDevice]} 
        onPress={() => selectDevice(item)}
      >
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <Text style={styles.deviceId}>{item.id}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OBD Device Scanner</Text>
      
      {/* Status display */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusItem}>
          Bluetooth: <Text style={isBluetoothOn ? styles.statusOn : styles.statusOff}>
            {isBluetoothOn ? 'ON' : 'OFF'}
          </Text>
        </Text>
        <Text style={styles.statusItem}>
          Permissions: <Text style={hasPermissions ? styles.statusOn : styles.statusOff}>
            {hasPermissions ? 'GRANTED' : 'DENIED'}
          </Text>
        </Text>
        <Text style={styles.statusItem}>
          Connected: <Text style={isConnected ? styles.statusOn : styles.statusOff}>
            {isConnected ? 'YES' : 'NO'}
          </Text>
        </Text>
      </View>
      
      {/* Scan Controls */}
      <View style={styles.scanContainer}>
        <TouchableOpacity 
          style={[styles.button, (!isBluetoothOn || isScanning) && styles.disabledButton]} 
          onPress={handleScan}
          disabled={!isBluetoothOn || isScanning}
        >
          <Text style={styles.buttonText}>
            {isScanning ? 'Scanning...' : 'Scan for OBD Devices'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Device List */}
      {(obdDevices.length > 0 || isScanning) && (
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>OBD Devices</Text>
          
          {isScanning && (
            <ActivityIndicator size="large" color="#2196F3" />
          )}
          
          {obdDevices.length === 0 && !isScanning && (
            <Text style={styles.emptyText}>No OBD devices found</Text>
          )}
          
          <FlatList
            data={obdDevices}
            keyExtractor={(item) => item.id}
            renderItem={renderDeviceItem}
          />
          
          {selectedDevice && !isConnected && (
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={handleConnect}
            >
              <Text style={styles.buttonText}>
                Connect to {selectedDevice.name || 'Selected Device'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Connected Device Info */}
      {isConnected && connectedDevice && (
        <View style={styles.connectionContainer}>
          <Text style={styles.sectionTitle}>Connected to {connectedDevice.name || 'OBD Device'}</Text>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={fetchVehicleData}
          >
            <Text style={styles.buttonText}>Fetch Vehicle Data</Text>
          </TouchableOpacity>
          
          {Object.keys(vehicleData).length > 0 && (
            <View style={styles.dataContainer}>
              {Object.entries(vehicleData).map(([key, value]) => (
                <Text key={key} style={styles.dataItem}>
                  {key}: {value}
                </Text>
              ))}
            </View>
          )}
          
          <View style={styles.buttonGroup}>
            <TouchableOpacity 
              style={[styles.button, styles.dangerButton]} 
              onPress={handleDisconnect}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
  },
  statusItem: {
    fontSize: 14,
  },
  statusOn: {
    color: 'green',
    fontWeight: 'bold',
  },
  statusOff: {
    color: 'red',
    fontWeight: 'bold',
  },
  scanContainer: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#B0BEC5',
  },
  secondaryButton: {
    backgroundColor: '#4CAF50',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  listContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
    color: '#757575',
  },
  deviceItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedDevice: {
    backgroundColor: '#E3F2FD',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  deviceId: {
    color: '#757575',
    fontSize: 12,
  },
  connectionContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  dataContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  dataItem: {
    fontSize: 14,
    marginBottom: 4,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default OBDDeviceScanner;
