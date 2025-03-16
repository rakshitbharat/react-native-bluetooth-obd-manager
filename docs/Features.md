# React Native Bluetooth OBD Manager

A comprehensive React Native library for seamless communication with ELM327 OBD-II adapters via Bluetooth. This library handles all the complexities of Bluetooth communication, device discovery, and OBD protocol management.

## Key Features

- Automatic Bluetooth initialization and permission handling
- Smart service and characteristic discovery for various ELM327 adapters
- Stable connection management with automatic reconnection
- Real-time OBD data streaming with timeout protection
- Built-in command queue management
- Comprehensive error handling and logging
- TypeScript support

## Quick Start

```typescript
import { BluetoothProvider, useBluetooth, OBDDeviceScanner } from 'react-native-bluetooth-obd-manager';

// Wrap your app with BluetoothProvider
const App = () => (
  <BluetoothProvider>
    <YourApp />
  </BluetoothProvider>
);

// Use the hook in your components
const YourComponent = () => {
  const { 
    isBluetoothOn,
    hasPermissions,
    scanDevices,
    connectToDevice,
    sendCommand 
  } = useBluetooth();

  // Your component logic here
};
```

## Core Components

### BluetoothProvider
The root component that manages Bluetooth state and provides context to child components.

### Hooks

#### useBluetooth
The main hook for accessing Bluetooth functionality:
- `isBluetoothOn`: Current Bluetooth state
- `hasPermissions`: Permission status
- `isScanning`: Scanning status
- `discoveredDevices`: List of found devices
- `connectedDevice`: Currently connected device
- `scanDevices()`: Start device scanning
- `connectToDevice(id)`: Connect to a device
- `sendCommand(cmd)`: Send OBD command
- `disconnect()`: Disconnect from device

#### useOBDManager
Higher-level hook for OBD-specific operations:
- Initialize OBD communication
- Send standardized OBD commands
- Parse OBD responses
- Monitor multiple PIDs

### Example Components

#### OBDDeviceScanner
Ready-to-use component for scanning and connecting to OBD devices:
- Bluetooth status display
- Device scanning
- Device list with signal strength
- Connection management

#### OBDLiveData
Component for monitoring real-time vehicle data:
- Engine RPM
- Vehicle Speed
- Engine Temperature
- Throttle Position
- Custom PID monitoring

#### OBDTerminal
Debug terminal interface for direct OBD communication:
- Send raw AT and OBD commands
- View command history
- Quick command buttons
- Response logging

## Advanced Usage

### Custom Device Discovery

```typescript
const { scanDevices, discoveredDevices } = useBluetooth();

// Start scanning with custom timeout
await scanDevices(5000); // 5 second timeout

// Filter OBD devices
const obdDevices = discoveredDevices.filter(device => 
  device.name?.toLowerCase().includes('obd')
);
```

### Command Management

```typescript
const { sendCommand } = useBluetooth();

// Send command and get response
try {
  const rpm = await sendCommand('010C');
  console.log('Engine RPM:', rpm);
} catch (error) {
  console.error('Command failed:', error);
}
```

### Real-time Monitoring

```typescript
const { connectedDevice, sendCommand } = useBluetooth();
const [data, setData] = useState({});

useEffect(() => {
  if (!connectedDevice) return;
  
  const interval = setInterval(async () => {
    try {
      const rpm = await sendCommand('010C');
      const speed = await sendCommand('010D');
      setData({ rpm, speed });
    } catch (error) {
      console.error('Monitoring error:', error);
    }
  }, 1000);
  
  return () => clearInterval(interval);
}, [connectedDevice]);
```

## Error Handling

The library provides comprehensive error handling:
- Bluetooth state errors
- Permission errors
- Connection errors
- Command timeout errors
- Protocol errors

```typescript
try {
  await connectToDevice(deviceId);
} catch (error) {
  if (error instanceof BluetoothOBDError) {
    switch (error.type) {
      case BluetoothErrorType.CONNECTION_ERROR:
        // Handle connection error
        break;
      case BluetoothErrorType.TIMEOUT_ERROR:
        // Handle timeout
        break;
      // etc.
    }
  }
}
```

## Best Practices

1. Always wrap your app with BluetoothProvider
2. Check Bluetooth state and permissions before operations
3. Handle device disconnections gracefully
4. Implement proper error handling
5. Clean up resources when components unmount
6. Use the built-in timeout protection
7. Implement retry logic for important operations

## Requirements

- React Native >= 0.63.0
- iOS 11+ or Android 6.0+
- Bluetooth LE capable device
- ELM327-compatible OBD-II adapter