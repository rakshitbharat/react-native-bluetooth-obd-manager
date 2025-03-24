# React Native Bluetooth OBD Manager

A comprehensive and robust library for connecting to ELM327-based OBD-II adapters via Bluetooth in React Native applications. This library makes it simple to scan for OBD adapters, connect to them, and retrieve vehicle data.

## Features

- 🚙 Easy connection to any ELM327 OBD-II adapter via Bluetooth LE
- 🔌 Automatic service and characteristic discovery
- 🧰 Built-in support for standard OBD-II PIDs and commands
- 📊 Live vehicle data monitoring (RPM, speed, temperature, etc.)
- 🔍 Diagnostic trouble code (DTC) reading and clearing
- 🔄 Automatic reconnection to previously used devices
- 📱 React hooks-based API for easy integration
- 🛠️ Includes ready-to-use UI components for quick implementation

## ⚠️ Important Prerequisites

> **Note**: This library assumes you have already set up the required dependencies in your React Native project. Please set up all dependent libraries before proceeding with this library's implementation.

- [react-native-ble-manager](https://github.com/innoveit/react-native-ble-manager) - Follow their installation and setup instructions
- [react-native-bluetooth-state-manager](https://github.com/Drazail/react-native-bluetooth-state-manager) - Follow their setup guide
- [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage) - Complete their installation steps

This library assumes that you have already configured these dependencies correctly in your project. Please make sure to follow each dependency's setup instructions carefully before proceeding with this library's installation.

## Installation

```bash
npm install react-native-bluetooth-obd-manager
# or
yarn add react-native-bluetooth-obd-manager
```

### Dependencies

This library relies on the following packages which will be installed automatically:

- [react-native-ble-manager](https://github.com/innoveit/react-native-ble-manager)
- [react-native-bluetooth-state-manager](https://github.com/Drazail/react-native-bluetooth-state-manager)
- [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage)

### Required permissions

#### iOS
Add the following to your `Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to OBD-II adapters</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app uses Bluetooth to connect to OBD-II adapters</string>
```

#### Android
Add the following permissions to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<!-- For Android 12+ -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

## Detailed Usage Guide

### 1. Basic Connection Setup

First, wrap your application with the BluetoothProvider:

```jsx
import { BluetoothProvider } from 'react-native-bluetooth-obd-manager';

const App = () => {
  return (
    <BluetoothProvider>
      <YourAppContent />
    </BluetoothProvider>
  );
};
```

### 2. Implementing OBD Connection

Here's a complete example showing how to handle device scanning, connection, and data retrieval:

```jsx
import React, { useState, useCallback } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { useOBDManager } from 'react-native-bluetooth-obd-manager';

const OBDImplementation = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [vehicleData, setVehicleData] = useState({
    rpm: null,
    speed: null,
    temp: null
  });

  const obd = useOBDManager({
    onConnected: (deviceId) => {
      Alert.alert('Connected', `Successfully connected to OBD device: ${deviceId}`);
      // Start fetching data after connection
      fetchVehicleData();
    },
    onDisconnected: () => {
      Alert.alert('Disconnected', 'OBD device disconnected');
      setVehicleData({ rpm: null, speed: null, temp: null });
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
    autoInit: true, // Automatically initialize OBD on connection
    connectToLast: true // Try to reconnect to the last device used
  });

  const handleStartScan = useCallback(async () => {
    try {
      setIsScanning(true);
      await obd.scanForDevices(5000); // Scan for 5 seconds
    } catch (error) {
      Alert.alert('Scan Error', error.message);
    } finally {
      setIsScanning(false);
    }
  }, [obd]);

  const handleConnect = useCallback(async (deviceId) => {
    try {
      await obd.connectToDevice(deviceId);
    } catch (error) {
      Alert.alert('Connection Error', error.message);
    }
  }, [obd]);

  const fetchVehicleData = useCallback(async () => {
    if (!obd.isConnected) return;

    try {
      const data = await obd.getLiveData();
      setVehicleData({
        rpm: data.rpm,
        speed: data.speed,
        temp: data.coolantTemp
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [obd]);

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 20 }}>
        Status: {obd.status}
      </Text>

      {!obd.isConnected ? (
        <>
          <Button
            title={isScanning ? 'Scanning...' : 'Scan for OBD Devices'}
            onPress={handleStartScan}
            disabled={isScanning}
          />

          {obd.bluetooth.discoveredDevices.map(device => (
            <Button
              key={device.id}
              title={`Connect to ${device.name || device.id}`}
              onPress={() => handleConnect(device.id)}
            />
          ))}
        </>
      ) : (
        <>
          <Text>RPM: {vehicleData.rpm || 'N/A'}</Text>
          <Text>Speed: {vehicleData.speed ? `${vehicleData.speed} km/h` : 'N/A'}</Text>
          <Text>Coolant Temp: {vehicleData.temp ? `${vehicleData.temp}°C` : 'N/A'}</Text>
          
          <Button
            title="Refresh Data"
            onPress={fetchVehicleData}
          />
          
          <Button
            title="Disconnect"
            onPress={obd.disconnect}
            color="red"
          />
        </>
      )}
    </View>
  );
};
```

### 3. Common Use Cases

#### Reading Diagnostic Trouble Codes (DTCs)

```jsx
const DiagnosticScreen = () => {
  const obd = useOBDManager();
  const [dtcCodes, setDtcCodes] = useState([]);

  const readDTC = async () => {
    try {
      const codes = await obd.getDiagnosticCodes();
      setDtcCodes(codes);
    } catch (error) {
      Alert.alert('Error', 'Failed to read DTCs');
    }
  };

  const clearDTC = async () => {
    try {
      await obd.clearDiagnosticCodes();
      setDtcCodes([]);
      Alert.alert('Success', 'DTCs cleared successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear DTCs');
    }
  };

  return (
    <View>
      <Button title="Read DTCs" onPress={readDTC} />
      <Button title="Clear DTCs" onPress={clearDTC} />
      {dtcCodes.map(code => (
        <Text key={code}>{code}</Text>
      ))}
    </View>
  );
};
```

#### Continuous Data Monitoring

```jsx
const LiveMonitoring = () => {
  const obd = useOBDManager();
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    let interval;

    if (isMonitoring && obd.isConnected) {
      interval = setInterval(async () => {
        const data = await obd.getLiveData();
        // Handle the data update
        console.log('Live Data:', data);
      }, 1000); // Update every second
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring, obd.isConnected]);

  return (
    <View>
      <Button
        title={isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
        onPress={() => setIsMonitoring(!isMonitoring)}
      />
    </View>
  );
};
```

### 4. Error Handling

```jsx
const ErrorHandlingExample = () => {
  const obd = useOBDManager({
    onError: (error) => {
      switch (error.code) {
        case 'DEVICE_NOT_FOUND':
          Alert.alert('Error', 'OBD device not found. Please check the connection.');
          break;
        case 'BLUETOOTH_DISABLED':
          Alert.alert('Error', 'Please enable Bluetooth to continue.');
          break;
        case 'INITIALIZATION_FAILED':
          Alert.alert('Error', 'Failed to initialize OBD. Please try reconnecting.');
          break;
        default:
          Alert.alert('Error', error.message);
      }
    }
  });

  return (
    // Your component JSX
  );
};
```

### 5. Best Practices

1. **Connection Management**
   - Always handle disconnections gracefully
   - Implement automatic reconnection when appropriate
   - Clear any ongoing operations when disconnected

```jsx
useEffect(() => {
  if (!obd.isConnected) {
    // Clean up any ongoing operations
    setVehicleData(null);
    setIsMonitoring(false);
  }
}, [obd.isConnected]);
```

2. **Performance Optimization**
   - Use appropriate polling intervals (don't query too frequently)
   - Implement data caching when needed
   - Clean up resources when component unmounts

3. **Error Recovery**
   - Implement retry logic for failed operations
   - Provide clear feedback to users
   - Log errors for debugging

### 6. Troubleshooting Common Issues

1. **Connection Problems**
   - Verify Bluetooth is enabled
   - Check if the OBD device is powered
   - Ensure vehicle ignition is on
   - Try restarting the OBD device

2. **Data Reading Issues**
   - Verify PID support for your vehicle
   - Check connection quality
   - Ensure proper initialization sequence

3. **Performance Issues**
   - Reduce polling frequency
   - Limit number of PIDs being monitored
   - Check for memory leaks in your implementation

## API Reference

### BluetoothProvider

The context provider that manages Bluetooth state and connections.

```jsx
<BluetoothProvider>
  {/* Your app content */}
</BluetoothProvider>
```

### useOBDManager Hook

The main hook for interacting with OBD devices.

```javascript
const obd = useOBDManager({
  onConnected: (deviceId) => {},
  onDisconnected: () => {},
  onError: (error) => {},
  autoInit: true,
  connectToLast: true,
});
```

#### Options

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `onConnected` | `(deviceId: string) => void` | `undefined` | Callback when device is connected |
| `onDisconnected` | `() => void` | `undefined` | Callback when device is disconnected |
| `onError` | `(error: Error) => void` | `undefined` | Callback when error occurs |
| `autoInit` | `boolean` | `true` | Automatically initialize OBD on connection |
| `connectToLast` | `boolean` | `true` | Try to reconnect to the last device on start |

#### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `connectToDevice` | `(deviceId: string) => Promise<boolean>` | Connect to a device by ID |
| `disconnect` | `() => Promise<boolean>` | Disconnect from current device |
| `scanForDevices` | `(timeoutMs?: number) => Promise<boolean>` | Scan for available devices |
| `reconnectToLastDevice` | `() => Promise<boolean>` | Reconnect to the last used device |
| `getRecentDevices` | `() => Promise<Array<Device>>` | Get recently used devices |
| `initialized` | `boolean` | Whether OBD interface is initialized |
| `status` | `'disconnected'/'connecting'/'connected'/'ready'` | Current connection status |
| `isConnected` | `boolean` | Whether connected to a device |
| `connectedDevice` | `Device \| null` | Currently connected device |
| `lastError` | `Error \| null` | Last error that occurred |
| `sendCommand` | `(command: string, timeoutMs?: number) => Promise<string>` | Send raw OBD command |
| `getRPM` | `() => Promise<number \| null>` | Get current engine RPM |
| `getSpeed` | `() => Promise<number \| null>` | Get current vehicle speed |
| `getCoolantTemp` | `() => Promise<number \| null>` | Get engine coolant temperature |
| `getLiveData` | `() => Promise<{rpm?: number, speed?: number,...}>` | Get multiple data points |
| `getDiagnosticCodes` | `() => Promise<string[]>` | Get diagnostic trouble codes |
| `clearDiagnosticCodes` | `() => Promise<boolean>` | Clear trouble codes |
| `getVIN` | `() => Promise<string \| null>` | Get vehicle identification number |
| `getBatteryVoltage` | `() => Promise<number \| null>` | Get battery voltage |

### Built-in Components

#### OBDLiveData

A ready-to-use component that displays live vehicle data.

```jsx
<OBDLiveData />
```

#### OBDDeviceScanner

A component for scanning and connecting to OBD devices.

```jsx
<OBDDeviceScanner onDeviceSelect={(device) => {}} />
```

#### OBDTerminal

A terminal-like interface for sending raw commands to the OBD adapter.

```jsx
<OBDTerminal />
```

## Advanced Usage

### Custom OBD Commands

You can send custom OBD commands using the `sendCommand` function:

```javascript
const response = await obd.sendCommand('010C'); // Get RPM
console.log('Raw response:', response);

// Or with mode and PID separated
import { formatPidCommand, OBD_MODES } from 'react-native-bluetooth-obd-manager';

const pidCommand = formatPidCommand(OBD_MODES.CURRENT_DATA, '0C');
const response = await obd.sendCommand(pidCommand);
```

### Value Conversion

You can convert raw OBD responses to meaningful values:

```javascript
import { convertPidValue } from 'react-native-bluetooth-obd-manager';

const response = await obd.sendCommand('010C');
const rpmValue = convertPidValue(response, '010C');
console.log('Engine RPM:', rpmValue);
```

### Device Compatibility Management

The library includes utilities to manage device compatibility and remember previous connection details:

```javascript
import { DeviceCompatibilityManager, isOBDDevice } from 'react-native-bluetooth-obd-manager';

// Check if a discovered device is likely an OBD adapter
const devices = obd.bluetooth.discoveredDevices;
const obdDevices = devices.filter(device => isOBDDevice(device));

// Get recently used OBD devices
const recentDevices = await DeviceCompatibilityManager.getRecentDevices(5, true);
```

## Troubleshooting

### Connection Issues

1. Make sure your device's Bluetooth is turned on
2. Some OBD adapters need to be paired in the system settings first
3. Try powering off and on the OBD adapter
4. Verify that the OBD adapter is properly connected to the vehicle's OBD port
5. Some vehicles require the ignition to be turned on for the OBD port to function

### Command Timeouts

1. Increase the timeout value in the `sendCommand` function
2. Check if the vehicle supports the PID you're requesting
3. Make sure the engine is running for some PIDs that require the engine to be active

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
