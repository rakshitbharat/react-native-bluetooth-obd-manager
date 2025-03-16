import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { useBluetooth } from '../hooks/useBluetooth';
import { useOBDManager } from '../hooks/useOBDManager';

export const OBDLiveData: React.FC = () => {
  const { connectedDevice, isReady } = useBluetooth();
  const { sendCommand } = useOBDManager();
  const [data, setData] = useState<Record<string, string>>({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Example PIDs to monitor
  const PIDs = [
    { id: 'rpm', label: 'Engine RPM', command: '010C' },
    { id: 'speed', label: 'Vehicle Speed', command: '010D' },
    { id: 'load', label: 'Engine Load', command: '0104' },
    { id: 'coolant', label: 'Coolant Temp', command: '0105' },
  ];

  // Start the live data monitoring when a device is connected
  useEffect(() => {
    if (connectedDevice && isReady && !isMonitoring) {
      const startMonitoring = async () => {
        setIsMonitoring(true);
        try {
          await sendCommand('ATZ'); // Reset the adapter
          await sendCommand('ATE0'); // Turn off echo
          await sendCommand('ATH0'); // Turn off headers
          await sendCommand('ATS0'); // Turn off spaces
          await sendCommand('ATL0'); // Turn off linefeeds

          // Start monitoring the PID data
          setIntervalId(
            setInterval(async () => {
              for (const pid of PIDs) {
                try {
                  const response = await sendCommand(pid.command);
                  setData(prev => ({
                    ...prev,
                    [pid.id]: response,
                  }));
                } catch (error) {
                  console.error(`Error fetching ${pid.label}:`, error);
                }
              }
            }, 2000),
          );
        } catch (error) {
          setIsMonitoring(false);
          console.error('Failed to start monitoring:', error);
        }
      };

      startMonitoring();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [connectedDevice, isReady, isMonitoring, PIDs, sendCommand]);

  if (!connectedDevice) {
    return (
      <View style={styles.container}>
        <Text>Connect to an OBD device first</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {Object.entries(data).map(([name, value]) => (
        <View key={name} style={styles.dataRow}>
          <Text style={styles.label}>{name}:</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
  },
});
