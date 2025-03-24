# React Native Bluetooth OBD Manager

A React Native library that eliminates the complexity of setting up Bluetooth communication with ELM327 OBD-II adapters. This library focuses on solving the most frustrating part of OBD projects - the initial Bluetooth and OBD setup.

## ⚠️ Important: Required Dependencies

Before using this library, ensure you have properly set up these dependencies in your React Native project:

- [react-native-ble-manager](https://github.com/innoveit/react-native-ble-manager)
- [react-native-bluetooth-state-manager](https://github.com/Drazail/react-native-bluetooth-state-manager)
- [react-native-permissions](https://github.com/zoontek/react-native-permissions)

**Note**: This library assumes you have already configured these dependencies correctly. Please complete their setup before proceeding.

## Installation

```bash
npm install react-native-bluetooth-obd-manager
# or
yarn add react-native-bluetooth-obd-manager
```

## Core Features

This library handles all the complex parts of OBD communication:

1. Smart Connection: Automatically handles service & characteristic discovery for any ELM327 device
2. Command Management: Send commands and get responses directly, no need to handle notifications manually
3. Auto Protocol Detection: Works with old and new ELM327 devices

## Basic Usage

Wrap your app with BluetoothProvider:

```javascript
import { BluetoothProvider } from 'react-native-bluetooth-obd-manager';

const App = () => (
  <BluetoothProvider>
    <YourApp />
  </BluetoothProvider>
);
```

Connect and communicate with OBD device:

```javascript
import { useOBDManager } from 'react-native-bluetooth-obd-manager';

const OBDComponent = () => {
  const obd = useOBDManager();

  const connect = async () => {
    // Library handles all the complex parts:
    // - Finding right service & characteristics
    // - Setting up proper write type
    // - Handling notifications
    await obd.connectToDevice('00:00:00:00:00:00');
  };

  const sendCommand = async () => {
    // Library automatically:
    // - Converts string to bytes
    // - Uses correct write method
    // - Waits for complete response
    const response = await obd.sendCommand('ATZ');
    console.log(response); // Direct response, no notification handling needed
  };
};
```

## Advanced Usage

### 1. Custom Protocol & Low-Level Commands

```javascript
const AdvancedOBDImplementation = () => {
  const obd = useOBDManager();

  const customProtocolOperations = async () => {
    // Force specific protocol (ISO 15765-4 CAN)
    await obd.sendCommand('ATSP6');
    
    // Read voltage from car battery
    const voltage = await obd.sendCommand('ATRV');
    
    // Configure timing and protocol settings
    await obd.sendCommand('ATAT2'); // Adaptive timing
    await obd.sendCommand('ATST64'); // Set timeout
  };
};
```

### 2. Real-Time Data Monitoring

```javascript
const BatchMonitoring = () => {
  const obd = useOBDManager();

  const startMonitoring = async () => {
    const pids = ['0C', '0D', '05']; // RPM, Speed, Coolant
    
    while (true) {
      const responses = await Promise.all(
        pids.map(pid => obd.sendCommand(`01${pid}`))
      );
      
      console.log({
        rpm: responses[0],
        speed: responses[1],
        coolant: responses[2]
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };
};
```

### 3. Error Recovery

```javascript
const RobustOBDImplementation = () => {
  const obd = useOBDManager({
    onError: async (error) => {
      if (error.code === 'TIMEOUT') {
        await obd.sendCommand('ATZ'); // Reset
        await obd.initializeOBD();
      }
    }
  });

  const sendCommandWithRetry = async (command, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await obd.sendCommand(command);
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };
};
```

## Key Implementation Notes

1. The library handles all Bluetooth initialization and setup internally
2. Command responses are returned directly - no need to handle event listeners
3. Connection stability is managed automatically
4. Protocol detection and setup is automatic
5. Error recovery and timeouts are built-in

## Common Issues Solved

This library automatically handles:

1. Finding the correct service and characteristic for your specific ELM327 device
2. Choosing between write/writeWithoutResponse based on device capabilities
3. Managing notification streams and response parsing
4. Handling protocol initialization and setup
5. Managing command timeouts and retries
