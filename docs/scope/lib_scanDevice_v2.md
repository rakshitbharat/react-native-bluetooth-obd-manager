Yes, absolutely. The library, as designed and documented through the `useBluetooth` hook, directly provides both the flag indicating a scan is in progress and the list of discovered devices.

Here's the Markdown documentation explaining how users can utilize these features:

---

## Monitoring Scan Progress and Results

The `useBluetooth` hook provides essential state variables to track the status of a device scan and access the results in real time.

**1. Tracking Scan Status: `isScanning`**

*   **What it is:** A boolean state variable (`true` or `false`) available directly from the `useBluetooth` hook.
*   **Purpose:** Indicates whether a device scan initiated by `scanDevices()` is currently active.
    *   `isScanning` becomes `true` immediately when `scanDevices()` is called successfully and starts the scanning process.
    *   `isScanning` becomes `false` when the scan stops, either because the specified `scanDuration` has elapsed or because `stopScan()` was called manually.
*   **How to Use:** You can use this flag to provide visual feedback to the user or control UI elements.

```typescript
import React from 'react';
import { View, Button, ActivityIndicator, Text } from 'react-native';
import { useBluetooth } from 'react-native-bluetooth-obd-manager';

const ScanButtonComponent = () => {
  const { scanDevices, isScanning, isBluetoothOn, hasPermissions } = useBluetooth();

  const handleScan = async () => {
    if (isBluetoothOn && hasPermissions && !isScanning) {
      try {
        await scanDevices(5000); // Scan for 5 seconds
        console.log("Scan finished.");
      } catch (error) {
        console.error("Scan failed:", error);
      }
    }
  };

  return (
    <View style={{ alignItems: 'center', marginVertical: 10 }}>
      <Button
        title={isScanning ? 'Scanning...' : 'Scan for Devices'}
        onPress={handleScan}
        // Disable button if already scanning or prerequisites not met
        disabled={isScanning || !isBluetoothOn || !hasPermissions}
      />
      {/* Show an activity indicator only when scanning */}
      {isScanning && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
          <ActivityIndicator size="small" />
          <Text style={{ marginLeft: 5 }}>Looking for devices...</Text>
        </View>
      )}
    </View>
  );
};
```

**2. Accessing Discovered Devices: `discoveredDevices`**

*   **What it is:** An array state variable (`Peripheral[]`) available directly from the `useBluetooth` hook. Each element in the array is a `Peripheral` object (as defined by `react-native-ble-manager`), typically containing `id`, `name`, `rssi`, etc.
*   **Purpose:** Holds the list of unique Bluetooth peripherals found during the most recent or ongoing scan.
    *   The array is **cleared** when a new scan starts via `scanDevices()`.
    *   It is **populated progressively** as new devices are discovered *during* the scan. Your UI will update in real time as devices appear.
    *   When the scan finishes (`isScanning` becomes `false`), this array contains the **complete list** of unique devices found during that specific scan session.
*   **How to Use:** Use this array to display a list of nearby devices to the user, allowing them to select one for connection. Remember to use the `item.id` property when calling `connectToDevice`.

```typescript
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useBluetooth } from 'react-native-bluetooth-obd-manager';
import type { Peripheral } from 'react-native-ble-manager'; // Import type

const DeviceListComponent = () => {
  const { discoveredDevices, connectToDevice, isScanning, connectedDevice } = useBluetooth();

  const handleConnect = async (device: Peripheral) => {
     if (isScanning) {
       Alert.alert("Info", "Please wait for the scan to finish before connecting.");
       return;
     }
     if (connectedDevice) {
        Alert.alert("Info", `Already connected to ${connectedDevice.name || connectedDevice.id}`);
        return;
     }
     console.log(`Attempting to connect to ${device.name || device.id}`);
     try {
        await connectToDevice(device.id); // Use the device ID
        Alert.alert("Success", `Connected to ${device.name || device.id}`);
     } catch (error: any) {
        Alert.alert("Error", `Failed to connect: ${error.message}`);
     }
  };


  return (
    <View style={{ flex: 1, width: '100%' }}>
      <Text style={{ fontSize: 16, fontWeight: 'bold', margin: 10 }}>Discovered Devices:</Text>
      <FlatList
        data={discoveredDevices}
        keyExtractor={(item) => item.id} // Use device ID as the key
        renderItem={({ item }) => (
          <TouchableOpacity
             onPress={() => handleConnect(item)}
             style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}
             disabled={isScanning || !!connectedDevice} // Disable connect during scan or if already connected
          >
            <Text style={{ fontWeight: 'bold' }}>{item.name || 'Unnamed Device'}</Text>
            <Text>ID: {item.id}</Text>
            <Text>RSSI: {item.rssi}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>{isScanning ? 'Scanning...' : 'No devices found.'}</Text>}
      />
    </View>
  );
};
```

**In Summary:**

The `useBluetooth` hook directly provides the necessary state for managing device scanning: `isScanning` tells you *if* a scan is active, and `discoveredDevices` gives you the *results* of the scan as they come in and the final list upon completion.