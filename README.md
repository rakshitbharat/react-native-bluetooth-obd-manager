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

## Basic Usage

### 1. Wrap your app with BluetoothProvider

```jsx
import React from 'react';
import { BluetoothProvider } from 'react-native-bluetooth-obd-manager';

const App = () => {
  return (
    <BluetoothProvider>
      <YourAppContent />
    </BluetoothProvider>
  );
};

export default App;
```

### 2. Use the OBDManager hook

```jsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button } from 'react-native';
import { useOBDManager } from 'react-native-bluetooth-obd-manager';

const OBDScreen = () => {
  const [rpm, setRpm] = useState(null);
  const [speed, setSpeed] = useState(null);
  
  const obd = useOBDManager({
    onConnected: (deviceId) => console.log(`Connected to ${deviceId}`),
    onDisconnected: () => console.log('Disconnected'),
    onError: (error) => console.error('OBD Error:', error),
  });
  
  const scanForDevices = async () => {
    await obd.scanForDevices(5000); // Scan for 5 seconds
  };
  
  const connectToDevice = async (deviceId) => {
    await obd.connectToDevice(deviceId);
  };
  
  const fetchData = async () => {
    if (obd.isConnected) {
      const rpmValue = await obd.getRPM();
      const speedValue = await obd.getSpeed();
      
      setRpm(rpmValue);
      setSpeed(speedValue);
    }
  };
  
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Status: {obd.status}</Text>
      
      {obd.isConnected ? (
        <View>
          <Text>RPM: {rpm || 'Unknown'}</Text>
          <Text>Speed: {speed ? `${speed} km/h` : 'Unknown'}</Text>
          <Button title="Fetch Data" onPress={fetchData} />
          <Button title="Disconnect" onPress={obd.disconnect} />
        </View>
      ) : (
        <View>
          <Button title="Scan for Devices" onPress={scanForDevices} />
          
          {obd.bluetooth.discoveredDevices.map(device => (
            <Button 
              key={device.id}
              title={device.name || 'Unknown Device'} 
              onPress={() => connectToDevice(device.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export default OBDScreen;
```

### 3. Or use the built-in components

```jsx
import React from 'react';
import { View } from 'react-native';
import { OBDLiveData } from 'react-native-bluetooth-obd-manager';

const OBDScreen = () => {
  return (
    <View style={{ flex: 1 }}>
      <OBDLiveData />
    </View>
  );
};

export default OBDScreen;
```

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
