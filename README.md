# React Native Bluetooth OBD Manager

An out-of-the-box solution for communicating with ELM327 OBD-II adapters in React Native applications. This library handles all the complexities of Bluetooth communication and OBD protocol management, letting you focus on building your vehicle diagnostic app.

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

The library requires the following peer dependencies:

```bash
npm install react-native-ble-manager react-native-permissions
# or
yarn add react-native-ble-manager react-native-permissions
```

### iOS Setup

1. Add the following to your `Info.plist`:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Your app needs Bluetooth to communicate with OBD devices</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Your app needs Bluetooth to communicate with OBD devices</string>
```

2. Install pods:
```bash
cd ios && pod install
```

### Android Setup

1. Add the following permissions to your `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<!-- For Android 12+ -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
```

## Basic Usage

1. Wrap your app with BluetoothProvider:

```jsx
import { BluetoothProvider } from 'react-native-bluetooth-obd-manager';

export default function App() {
  return (
    <BluetoothProvider>
      <YourApp />
    </BluetoothProvider>
  );
}
```

2. Use the included scanner component to get started quickly:

```jsx
import { OBDDeviceScanner } from 'react-native-bluetooth-obd-manager';

export default function ScanScreen() {
  return <OBDDeviceScanner />;
}
```

3. Or use the hooks for custom implementation:

```jsx
import { useBluetooth } from 'react-native-bluetooth-obd-manager';

function CustomScanner() {
  const { 
    isBluetoothOn,
    hasPermissions,
    scanDevices,
    connectToDevice,
    sendCommand
  } = useBluetooth();

  const handleScan = async () => {
    if (!isBluetoothOn || !hasPermissions) return;
    await scanDevices();
  };

  return (
    <Button title="Scan for Devices" onPress={handleScan} />
  );
}
```

## Example Components

The library includes three ready-to-use components:

1. **OBDDeviceScanner**: For discovering and connecting to OBD devices
2. **OBDLiveData**: For monitoring real-time vehicle data
3. **OBDTerminal**: For direct AT and OBD command interface

To use them:

```jsx
import { 
  OBDDeviceScanner,
  OBDLiveData,
  OBDTerminal
} from 'react-native-bluetooth-obd-manager';

// In your navigation/screens:
<OBDDeviceScanner />  // For device discovery
<OBDLiveData />       // For real-time monitoring
<OBDTerminal />       // For direct command interface
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

### Debug Mode

Enable debug mode for detailed logs:

```jsx
<BluetoothProvider debug={true}>
  <YourApp />
</BluetoothProvider>
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/yourusername/react-native-bluetooth-obd-manager/issues).
