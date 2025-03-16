import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useBluetooth } from '../hooks/useBluetooth';
import { useOBDManager } from '../hooks/useOBDManager';

export const OBDLiveData: React.FC = () => {
  const { connectedDevice } = useBluetooth();
  const { sendCommand } = useOBDManager();
  const [data, setData] = useState<Record<string, string>>({});

  // Example PIDs to monitor
  const PIDs = {
    'Engine RPM': '010C',
    'Vehicle Speed': '010D',
    'Engine Load': '0104',
    'Coolant Temp': '0105'
  };

  useEffect(() => {
    if (!connectedDevice) return;

    let mounted = true;
    const interval = setInterval(async () => {
      if (!mounted) return;

      for (const [name, pid] of Object.entries(PIDs)) {
        try {
          const response = await sendCommand(pid);
          if (mounted) {
            setData(prev => ({
              ...prev,
              [name]: response
            }));
          }
        } catch (error) {
          console.warn(`Error reading ${name}:`, error);
        }
      }
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [connectedDevice]);

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
