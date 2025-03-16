# React Native Bluetooth OBD Manager

⚠️ **IMPORTANT PREREQUISITE NOTE** ⚠️
This library is NOT a guide for setting up React Native or its dependencies. You MUST have a working React Native project with all necessary Bluetooth libraries properly installed and configured before using this library.

## Required Prerequisites

Before using this library, ensure you have:

1. A working React Native project
2. Properly installed and configured:
   - react-native-ble-manager
   - react-native-permissions
3. Properly set up Bluetooth permissions in your iOS and Android projects
4. Basic understanding of Bluetooth LE communication

If you haven't set these up, this library will NOT work. Please set up your project with all dependencies first.

## Purpose

This library provides a stable connection interface for ELM327 OBD devices, focusing on three core functionalities:
1. Connecting to OBD devices with smart service discovery
2. Sending commands and receiving responses
3. Clean disconnection and state management

## Features

### 🔗 Core Features

1. **Smart Bluetooth Connection**
   - Automatic service and characteristic discovery
   - Support for old and new ELM327 adapters
   - Built-in retry mechanism
   - Connection state persistence
   - Real-time connection status updates

2. **Robust Command Interface**
   - Direct command-response pattern
   - Automatic response completion detection
   - Command timeout protection
   - Smart write characteristic selection
   - Built-in command queuing

3. **Clean Disconnection**
   - Proper device reset before disconnect
   - Automatic cleanup of notification listeners
   - State reset on disconnect
   - Reconnection handling

## Installation

```bash
npm install react-native-bluetooth-obd-manager
# or
yarn add react-native-bluetooth-obd-manager
```

### Required Peer Dependencies
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

Add the following permissions to your `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<!-- For Android 12+ -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
```

## Quick Start

1. **Wrap your app with BluetoothProvider:**

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

2. **Use the hook in your components:**

```jsx
import { useBluetooth } from 'react-native-bluetooth-obd-manager';

function YourComponent() {
  const { 
    connectToDevice, 
    sendCommand, 
    disconnect
  } = useBluetooth();

  // Connect to device
  const handleConnect = async (deviceId) => {
    const connected = await connectToDevice(deviceId);
    if (connected) {
      // Device connected successfully
      const response = await sendCommand('ATZ'); // Reset device
      console.log('Device reset:', response);
    }
  };

  // Send a command
  const handleCommand = async () => {
    const rpm = await sendCommand('010C'); // Get engine RPM
    console.log('Engine RPM:', rpm);
  };

  // Disconnect
  const handleDisconnect = async (deviceId) => {
    await disconnect(deviceId);
  };
}
```

## Example Components

The library includes ready-to-use components:

### MinimalOBDExample

A minimal implementation showing core functionality:

```jsx
import { MinimalOBDExample } from 'react-native-bluetooth-obd-manager/examples';

function App() {
  return <MinimalOBDExample />;
}
```

### OBDDeviceScanner

For device discovery and connection:

```jsx
import { OBDDeviceScanner } from 'react-native-bluetooth-obd-manager/examples';

function App() {
  return <OBDDeviceScanner />;
}
```

### OBDTerminal 

For direct command interface:

```jsx
import { OBDTerminal } from 'react-native-bluetooth-obd-manager/examples';

function App() {
  return <OBDTerminal />;
}
```

## Hook API

### useBluetooth()

The main hook providing Bluetooth functionality:

```typescript
const {
  // States
  isBluetoothOn: boolean;
  hasPermissions: boolean;
  isScanning: boolean;
  discoveredDevices: Device[];
  connectedDevice: Device | null;
  error: string | null;

  // Core Functions
  connectToDevice: (deviceId: string) => Promise<boolean>;
  sendCommand: (command: string, timeoutMs?: number) => Promise<string>;
  disconnect: (deviceId: string) => Promise<boolean>;

  // Additional Functions
  scanDevices: (timeoutMs?: number) => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
} = useBluetooth();
```

## Device Compatibility

The library includes smart service discovery that supports various ELM327 adapters:

- Original ELM327 devices
- Common clone variants
- Chinese adapters with different service UUIDs
- Both modern and legacy Bluetooth implementations

## Error Handling

The library provides comprehensive error handling with the following error types:

```typescript
enum BluetoothErrorType {
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  CHARACTERISTIC_ERROR = 'CHARACTERISTIC_ERROR',
  NOTIFICATION_ERROR = 'NOTIFICATION_ERROR',
  WRITE_ERROR = 'WRITE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}
```

Example error handling:

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
    }
  }
}
```

## Best Practices

1. **Always wrap your app with BluetoothProvider**
   - Ensures proper initialization
   - Handles permission requests
   - Manages Bluetooth state

2. **Use the provided hooks**
   - They handle state management
   - Provide proper cleanup
   - Ensure stable connections

3. **Handle disconnections gracefully**
   - Listen for disconnection events
   - Implement reconnection logic
   - Clean up resources

4. **Command sending**
   - Add timeouts for commands
   - Handle errors appropriately
   - Use command queuing for multiple requests

## Troubleshooting

### Common Issues

1. **Device Not Found**
   - Ensure Bluetooth is enabled
   - Check if device is powered on
   - Verify permissions are granted
   - For Android 12+, ensure location is enabled

2. **Connection Issues**
   - Reset the OBD adapter
   - Ensure proper voltage to adapter
   - Check if car ignition is on
   - Try restarting Bluetooth

3. **Command Timeout**
   - Check adapter power supply
   - Verify command format
   - Ensure stable connection
   - Increase timeout for slow devices

## Requirements

- React Native >= 0.63.0
- iOS 11+ or Android 6.0+
- Bluetooth LE capable device
- ELM327-compatible OBD-II adapter

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/yourusername/react-native-bluetooth-obd-manager/issues).
