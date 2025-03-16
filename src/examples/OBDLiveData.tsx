import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useBluetooth } from '../hooks/useBluetooth';
import { useECUCommands } from '../hooks/useECUCommands';
import { STANDARD_PIDS } from '../utils/obdUtils';

interface LiveDataItem {
  name: string;
  pid: string;
  value: string | null;
  unit: string;
  refreshInterval?: number; // in milliseconds
}

const OBDLiveData: React.FC<{ 
  deviceId?: string;
  refreshRate?: number;
}> = ({ deviceId, refreshRate = 2000 }) => {
  const [liveData, setLiveData] = useState<LiveDataItem[]>([
    { name: 'Engine RPM', pid: STANDARD_PIDS.ENGINE_RPM, value: null, unit: 'RPM' },
    { name: 'Vehicle Speed', pid: STANDARD_PIDS.VEHICLE_SPEED, value: null, unit: 'km/h' },
    { name: 'Coolant Temp', pid: STANDARD_PIDS.ENGINE_COOLANT_TEMP, value: null, unit: '°C' },
    { name: 'Throttle Position', pid: STANDARD_PIDS.THROTTLE_POS, value: null, unit: '%' },
    { name: 'Intake MAP', pid: STANDARD_PIDS.INTAKE_MAP, value: null, unit: 'kPa' },
    { name: 'Battery Voltage', pid: '', value: null, unit: 'V', refreshInterval: 5000 },
  ]);
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const { 
    connectToDevice, 
    disconnect, 
    isConnected,
    connectedDevice,
  } = useBluetooth();
  
  const { 
    initializeOBD,
    getEngineRPM,
    getVehicleSpeed,
    getEngineCoolantTemp,
    getBatteryVoltage,
    getRawConnector
  } = useECUCommands();
  
  // Connect to device if deviceId is provided and not already connected
  useEffect(() => {
    if (deviceId && !connectedDevice) {
      connectAndInitialize();
    }
    
    return () => {
      if (isMonitoring) {
        stopMonitoring();
      }
      if (connectedDevice) {
        disconnect(connectedDevice.id);
      }
    };
  }, [deviceId]);
  
  // Connect to device and initialize OBD
  const connectAndInitialize = async () => {
    if (!deviceId || isInitialized) return;
    
    try {
      const connected = await connectToDevice(deviceId);
      
      if (connected) {
        const initialized = await initializeOBD();
        setIsInitialized(initialized);
      }
    } catch (error) {
      console.error('Failed to connect or initialize:', error);
    }
  };
  
  // Update a specific data item
  const updateDataItem = (name: string, value: string | null) => {
    setLiveData(currentData => 
      currentData.map(item => 
        item.name === name ? { ...item, value } : item
      )
    );
  };
  
  // Refresh all data once
  const refreshData = async () => {
    if (!isConnected || !isInitialized) return;
    
    setRefreshing(true);
    
    try {
      // Get engine RPM
      const rpm = await getEngineRPM();
      updateDataItem('Engine RPM', rpm);
      
      // Get vehicle speed
      const speed = await getVehicleSpeed();
      updateDataItem('Vehicle Speed', speed);
      
      // Get coolant temperature
      const coolant = await getEngineCoolantTemp();
      updateDataItem('Coolant Temp', coolant);
      
      // Get battery voltage
      const voltage = await getBatteryVoltage();
      updateDataItem('Battery Voltage', voltage);
      
      // For other PIDs, use raw connector
      const connector = getRawConnector();
      if (connector) {
        // Get throttle position
        const throttle = await connector.sendCommand(STANDARD_PIDS.THROTTLE_POS);
        updateDataItem('Throttle Position', throttle);
        
        // Get intake MAP
        const map = await connector.sendCommand(STANDARD_PIDS.INTAKE_MAP);
        updateDataItem('Intake MAP', map);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Start continuous monitoring
  const startMonitoring = () => {
    if (!isConnected || !isInitialized || isMonitoring) return;
    
    setIsMonitoring(true);
    
    // Initial refresh
    refreshData();
    
    // Set up intervals for each data item based on their refresh rate
    liveData.forEach(item => {
      const interval = item.refreshInterval || refreshRate;
      const timer = setInterval(async () => {
        if (!isConnected || !isInitialized) return;
        
        try {
          let value = null;
          
          // Get data based on item type
          switch (item.name) {
            case 'Engine RPM':
              value = await getEngineRPM();
              break;
            case 'Vehicle Speed':
              value = await getVehicleSpeed();
              break;
            case 'Coolant Temp':
              value = await getEngineCoolantTemp();
              break;
            case 'Battery Voltage':
              value = await getBatteryVoltage();
              break;
            default:
              // For other PIDs, use raw connector
              const connector = getRawConnector();
              if (connector && item.pid) {
                value = await connector.sendCommand(item.pid);
              }
          }
          
          updateDataItem(item.name, value);
        } catch (error) {
          console.error(`Error updating ${item.name}:`, error);
        }
      }, interval);
      
      // Store the timer ID for cleanup
      return () => clearInterval(timer);
    });
  };
  
  // Stop monitoring
  const stopMonitoring = () => {
    setIsMonitoring(false);
    // Timers will be cleared by React's effect cleanup
  };
  
  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    await refreshData();
  }, [isConnected, isInitialized]);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>OBD Live Data</Text>
      
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          Status: {isConnected ? 'Connected' : 'Disconnected'}
          {isInitialized ? ', Initialized' : ''}
          {isMonitoring ? ', Monitoring' : ''}
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
          />
        }
      >
        {liveData.map((item, index) => (
          <View key={index} style={styles.dataItem}>
            <Text style={styles.dataName}>{item.name}</Text>
            <Text style={styles.dataValue}>
              {item.value || 'N/A'} {item.value ? item.unit : ''}
            </Text>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        {!isMonitoring ? (
          <TouchableOpacity
            style={[styles.button, (!isConnected || !isInitialized) && styles.disabledButton]}
            onPress={startMonitoring}
            disabled={!isConnected || !isInitialized}
          >
            <Text style={styles.buttonText}>Start Monitoring</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={stopMonitoring}
          >
            <Text style={styles.buttonText}>Stop Monitoring</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.button, styles.refreshButton, (!isConnected || !isInitialized) && styles.disabledButton]}
          onPress={refreshData}
          disabled={!isConnected || !isInitialized || refreshing}
        >
          <Text style={styles.buttonText}>
            {refreshing ? 'Refreshing...' : 'Refresh Now'}
          </Text>
        </TouchableOpacity>
      </View>
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
  statusBar: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  dataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dataName: {
    fontSize: 16,
    fontWeight: '500',
  },
  dataValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#B0BEC5',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  refreshButton: {
    backgroundColor: '#4CAF50',
  },
});

export default OBDLiveData;
