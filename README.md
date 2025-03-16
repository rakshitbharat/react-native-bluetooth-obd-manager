# React Native Bluetooth OBD Manager

A comprehensive library for seamless communication with ELM327 OBD-II devices via Bluetooth in React Native applications.

## Features

- 🔍 Automatic scanning and detection of OBD devices
- 🔌 Smart connection handling for various ELM327 adapters
- 📱 iOS and Android platform support
- 🔄 Robust command transmission with response handling
- 🚗 Support for standard OBD-II PIDs
- 🛠️ Custom command support with raw and decoded responses
- 🔋 Automatic Bluetooth permission handling
- 📊 Real-time connection state monitoring

## Installation

```bash
npm install react-native-bluetooth-obd-manager
# or
yarn add react-native-bluetooth-obd-manager
```

### Dependencies

This library requires the following dependencies:

```bash
npm install react-native-ble-manager react-native-permissions convert-string text-decoding
```

## Basic Usage

```jsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button } from 'react-native';
import { BluetoothProvider, useBluetooth, useECUCommands } from 'react-native-bluetooth-obd-manager';

// Wrap your app with the BluetoothProvider
const App = () => {
  return (
    <BluetoothProvider>
      <OBDScreen />
    </BluetoothProvider>
  );
};

// Use the hooks in your components
const OBDScreen = () => {
  const [rpm, setRpm] = useState(null);
  const [speed, setSpeed] = useState(null);
  const { 
    isBluetoothOn, 
    hasPermissions, 
    scanDevices, 
    connectToDevice, 
    connectedDevice 
  } = useBluetooth();
  const { initializeOBD, getEngineRPM, getVehicleSpeed } = useECUCommands();

  // Handle connection to a device
  const connectToOBD = async (deviceId) => {
    const connected = await connectToDevice(deviceId);
    if (connected) {
      await initializeOBD();
    }
  };

  // Fetch vehicle data
  const fetchData = async () => {
    const rpmData = await getEngineRPM();
    const speedData = await getVehicleSpeed();
    setRpm(rpmData);
    setSpeed(speedData);
  };

  return (
    <View>
      <Text>Bluetooth: {isBluetoothOn ? 'ON' : 'OFF'}</Text>
      <Text>Permissions: {hasPermissions ? 'Granted' : 'Not Granted'}</Text>
      <Text>Connected: {connectedDevice ? 'Yes' : 'No'}</Text>

      <Button title="Scan" onPress={() => scanDevices()} />
      <Button 
        title="Connect" 
        onPress={() => connectToOBD('00:11:22:33:44:55')} 
        disabled={!isBluetoothOn || !hasPermissions}
      />
      <Button 
        title="Fetch Data" 
        onPress={fetchData} 
        disabled={!connectedDevice}
      />

      <Text>RPM: {rpm}</Text>
      <Text>Speed: {speed}</Text>
    </View>
  );
};

export default App;
```

## Advanced Usage

### Custom Commands

```jsx
const OBDAdvanced = () => {
  const { sendCommand } = useBluetooth();
  const { getRawConnector } = useECUCommands();
  
  const executeCustomCommand = async () => {
    // Direct command execution
    const result = await sendCommand('01 0C');
    console.log('RPM result:', result);
    
    // Using the raw connector for advanced usage
    const ecuConnector = getRawConnector();
    if (ecuConnector) {
      const data = await ecuConnector.sendCommand('AT RV');
      console.log('Battery voltage:', data);
    }
  };
  
  // Component implementation...
};
```

### Real-time Data Monitoring

```jsx
import { useOBDMonitoring } from 'react-native-bluetooth-obd-manager';

const LiveDataMonitor = () => {
  const { data, isMonitoring, startMonitoring, stopMonitoring } = useOBDMonitoring({
    refreshRate: 1000,  // Update every second
    enabledPids: ['rpm', 'speed', 'coolantTemp']
  });
  
  return (
    <View>
      <Text>RPM: {data.rpm || 'N/A'}</Text>
      <Text>Speed: {data.speed || 'N/A'} km/h</Text>
      <Text>Coolant: {data.coolantTemp || 'N/A'} °C</Text>
      
      {!isMonitoring ? (
        <Button title="Start Monitoring" onPress={startMonitoring} />
      ) : (
        <Button title="Stop Monitoring" onPress={stopMonitoring} />
      )}
    </View>
  );
};
```

## API Reference

### BluetoothProvider

Provider component that initializes Bluetooth functionality and makes it available throughout your app.

### Hooks

#### useBluetooth()

Core hook for Bluetooth operations.

```typescript
const {
  // States
  isInitialized: boolean,
  isBluetoothOn: boolean,
  hasPermissions: boolean,
  isScanning: boolean,
  discoveredDevices: Peripheral[],
  connectedDevice: Peripheral | null,
  isConnecting: boolean,
  isStreaming: boolean,
  error: string | null,
  
  // Functions
  scanDevices: (timeoutMs?: number) => Promise<boolean>,
  connectToDevice: (deviceId: string) => Promise<boolean>,
  disconnect: (deviceId: string) => Promise<boolean>,
  sendCommand: (command: string, timeoutMs?: number) => Promise<string>,
  requestPermissions: () => Promise<boolean>
} = useBluetooth();
```

#### useECUCommands()

Hook for working with standard OBD commands.

```typescript
const {
  initializeOBD: () => Promise<boolean>,
  getVIN: () => Promise<string | null>,
  getEngineRPM: () => Promise<string | null>,
  getVehicleSpeed: () => Promise<string | null>,
  getEngineCoolantTemp: () => Promise<string | null>,
  getBatteryVoltage: () => Promise<string | null>,
  getTroubleCodes: () => Promise<string | null>,
  clearTroubleCodes: () => Promise<boolean>,
  getRawConnector: () => ECUConnector | null,
  getDecodedConnector: () => ECUConnector | null
} = useECUCommands();
```

#### useDeviceDetection()

Hook for automatic OBD device detection.

```typescript
const {
  startDeviceScan: (timeoutMs?: number) => Promise<boolean>,
  isScanning: boolean,
  obdDevices: Peripheral[],
  selectedDevice: Peripheral | null,
  setSelectedDevice: (device: Peripheral | null) => void,
  allDevices: Peripheral[]
} = useDeviceDetection();
```

#### useOBDManager()

Hook for high-level OBD protocol management.

```typescript
const {
  connectionState: ConnectionState,
  protocol: OBDProtocol,
  protocolName: string,
  error: string | null,
  isInitializing: boolean,
  isInitialized: boolean,
  initialize: () => Promise<boolean>,
  sendCommand: (command: string) => Promise<string>,
  requestPid: (mode: number, pid: number) => Promise<any>
} = useOBDManager();
```

#### useOBDMonitoring()

Hook for real-time data monitoring.

```typescript
const {
  data: {
    rpm: number | null,
    speed: number | null,
    coolantTemp: number | null,
    throttlePosition: number | null,
    lastUpdated: Record<string, number>
  },
  isMonitoring: boolean,
  startMonitoring: () => boolean,
  stopMonitoring: () => void
} = useOBDMonitoring({
  refreshRate: 1000,
  enabledPids: ['rpm', 'speed', 'coolantTemp', 'throttlePosition']
});
```

## Constants and Utilities

### Standard PIDs

```typescript
import { STANDARD_PIDS } from 'react-native-bluetooth-obd-manager';

// Available PIDs:
STANDARD_PIDS.ENGINE_RPM        // '010C'
STANDARD_PIDS.VEHICLE_SPEED     // '010D'
STANDARD_PIDS.ENGINE_COOLANT_TEMP // '0105'
// ...more
```

### ELM Commands

```typescript
import { ELM_COMMANDS } from 'react-native-bluetooth-obd-manager';

// Available commands:
ELM_COMMANDS.RESET             // 'ATZ'
ELM_COMMANDS.ECHO_OFF          // 'ATE0'
ELM_COMMANDS.READ_VOLTAGE      // 'AT RV'
// ...more
```

### Data Parsing Utilities

```typescript
import { parseEngineRPM, parseVehicleSpeed } from 'react-native-bluetooth-obd-manager';

const rpmResponse = await sendCommand('010C');
const rpm = parseEngineRPM(rpmResponse); // Returns number value in RPM

const speedResponse = await sendCommand('010D');
const speed = parseVehicleSpeed(speedResponse); // Returns number value in km/h
```

## Troubleshooting

### Common Issues

1. **Permission Issues**: Make sure to call `requestPermissions()` from the `useBluetooth()` hook before attempting to scan or connect.

2. **Connection Failures**: Some adapters may require specific service discovery. Use the device manager to help identify and remember compatible devices.

3. **No Devices Found**: Some Android devices require location permissions and GPS to be enabled for Bluetooth scanning to work properly.

4. **Response Timeouts**: If commands consistently time out, try increasing the timeout value passed to `sendCommand()`.

## License

MIT
