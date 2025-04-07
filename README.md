# React Native Bluetooth OBD Manager

[![npm version](https://img.shields.io/npm/v/react-native-bluetooth-obd-manager.svg?style=flat)](https://www.npmjs.com/package/react-native-bluetooth-obd-manager)
[![npm downloads](https://img.shields.io/npm/dm/react-native-bluetooth-obd-manager.svg?style=flat)](https://www.npmjs.com/package/react-native-bluetooth-obd-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A React Native hook library (`useBluetooth`) designed to simplify Bluetooth Low Energy (BLE) communication with ELM327-compatible OBD-II adapters. It handles device scanning, smart connection (auto-detecting common ELM327 service/characteristic patterns), command execution (AT commands, OBD PIDs), and connection management.

**Note:** This library provides the communication layer. Parsing the responses from OBD-II commands (e.g., converting hex strings from PIDs like `010C` into RPM values) is **not** included and must be implemented by your application according to OBD-II standards (SAE J1979).

## Features

*   **Simple Hook Interface:** Manage all BLE OBD interactions via the `useBluetooth` hook.
*   **State Management:** Provides reactive state for Bluetooth power status, permissions, scanning activity, connected device, errors, etc.
*   **Device Scanning:** Scan for nearby BLE peripherals.
*   **Smart Connection:** Automatically attempts to connect using known Service/Characteristic UUIDs common among ELM327 clones, increasing compatibility.
*   **Command Execution:** Send AT/OBD commands (`sendCommand`, `sendCommandRaw`) with automatic handling of:
    *   Write type selection (`Write` vs `WriteWithoutResponse`).
    *   Required command termination (`\r`).
    *   Waiting for ELM327 prompt (`>`) to signal response completion.
    *   Command timeouts.
*   **Raw Byte Commands:** Option to send commands and receive the raw `Uint8Array` response (`sendCommandRaw`).
*   **Connection Management:** Graceful connect/disconnect functions.
*   **Real-time Disconnect Detection:** Automatically updates connection state if the device disconnects unexpectedly.
*   **Streaming Helper State:** Optional state (`isStreaming`, `setStreaming`) and automatic inactivity timeout to help manage continuous data polling loops.
*   **TypeScript Support:** Written entirely in TypeScript with strict typings.

## Installation

1.  **Install Library:**
    ```bash
    npm install react-native-bluetooth-obd-manager
    # or
    yarn add react-native-bluetooth-obd-manager
    ```

2.  **Install Peer Dependencies:** This library relies on `react-native-ble-manager` and `react-native-permissions`. You **must** install and configure them according to their respective documentation.
    ```bash
    npm install react-native-ble-manager react-native-permissions
    # or
    yarn add react-native-ble-manager react-native-permissions
    ```
    *   **`react-native-ble-manager` Setup:** Follow the [react-native-ble-manager installation guide](https://github.com/innoveit/react-native-ble-manager#installation) carefully for both iOS and Android (linking, permissions in `AndroidManifest.xml`, `Info.plist`).
    *   **`react-native-permissions` Setup:** Follow the [react-native-permissions installation guide](https://github.com/zoontek/react-native-permissions#setup) for both platforms (linking, adding `PermissionsUsage` strings in `Info.plist`).

3.  **Required Permissions (Examples):**
    *   **`Info.plist` (iOS):**
        ```xml
        <key>NSBluetoothAlwaysUsageDescription</key> <!-- Or NSBluetoothPeripheralUsageDescription -->
        <string>Allow $(PRODUCT_NAME) to connect to Bluetooth OBD adapters.</string>
        <key>NSLocationWhenInUseUsageDescription</key>
        <string>Allow $(PRODUCT_NAME) to find nearby Bluetooth devices.</string>
        ```
    *   **`AndroidManifest.xml` (Android):**
        ```xml
        <!-- Basic Bluetooth -->
        <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
        <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />

        <!-- Location (Needed for BLE scanning before Android 12) -->
        <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
        <!-- Optional: Add coarse location if targeting below Android 12 and fine is not strictly needed -->
        <!-- <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" android:maxSdkVersion="30"/> -->

        <!-- Android 12+ (API 31+) Specific Permissions -->
        <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
        <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

        <!-- Optional: Background location if needed for background scanning (requires careful setup) -->
        <!-- <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" /> -->

        <!-- Declare Bluetooth features -->
        <uses-feature android:name="android.hardware.bluetooth_le" android:required="true"/>
        ```

## Usage

1.  **Wrap your app (or relevant part) with `BluetoothProvider`:**

    ```tsx
    // App.tsx or similar entry point
    import React from 'react';
    import { BluetoothProvider } from 'react-native-bluetooth-obd-manager';
    import YourMainAppComponent from './YourMainAppComponent';

    const App = () => {
      return (
        <BluetoothProvider>
          <YourMainAppComponent />
        </BluetoothProvider>
      );
    };

    export default App;
    ```

2.  **Use the `useBluetooth` hook in your components:**

    ```tsx
    // YourMainAppComponent.tsx
    import React, { useState, useEffect, useCallback } from 'react';
    import { View, Text, Button, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
    import { useBluetooth, type PeripheralWithPrediction } from 'react-native-bluetooth-obd-manager';

    const YourMainAppComponent = () => {
      const {
        isBluetoothOn,
        hasPermissions,
        isScanning,
        discoveredDevices,
        connectedDevice,
        isConnecting,
        error, // Last error object
        checkPermissions,
        requestBluetoothPermissions,
        promptEnableBluetooth,
        scanDevices,
        connectToDevice,
        disconnect,
        sendCommand,
        // sendCommandRaw, // For raw byte responses
        // setStreaming, // For streaming state
        // isStreaming,
      } = useBluetooth();

      const [lastResponse, setLastResponse] = useState<string | null>(null);
      const [isLoadingCommand, setIsLoadingCommand] = useState(false);

      // --- Effects for Initial Checks ---
      useEffect(() => {
        // Check permissions on mount
        checkPermissions();
      }, [checkPermissions]);

      // --- Permission Handling ---
      const handleRequestPermissions = async () => {
        const granted = await requestBluetoothPermissions();
        if (!granted) {
          Alert.alert("Permissions Required", "Please grant Bluetooth and Location permissions.");
        }
      };

      // --- Bluetooth Enabling ---
      const handleEnableBluetooth = async () => {
         try {
            await promptEnableBluetooth(); // Shows prompt on Android
            // State update handled by listener
         } catch (err) {
            Alert.alert("Enable Bluetooth", "Please enable Bluetooth in your device settings.");
         }
      };

      // --- Scanning ---
      const handleScan = async () => {
        if (isScanning) return;
        try {
          await scanDevices(5000); // Scan for 5 seconds
          console.log('Scan finished.');
        } catch (err: any) {
          Alert.alert('Scan Error', err.message);
        }
      };

      // --- Connection ---
      const handleConnect = async (device: PeripheralWithPrediction) => {
        if (isConnecting || connectedDevice) return;
        try {
          await connectToDevice(device.id);
          Alert.alert('Connected!', `Successfully connected to ${device.name || device.id}`);
        } catch (err: any) {
          Alert.alert('Connection Error', err.message);
        }
      };

      // --- Disconnection ---
      const handleDisconnect = async () => {
        if (connectedDevice) {
          try {
            await disconnect();
            Alert.alert('Disconnected', 'Successfully disconnected.');
            setLastResponse(null); // Clear response on disconnect
          } catch (err: any) {
            Alert.alert('Disconnect Error', err.message);
          }
        }
      };

      // --- Sending Commands ---
      const handleSendCommand = async (cmd: string) => {
        if (!connectedDevice) {
           Alert.alert("Not Connected", "Please connect to a device first.");
           return;
        }
        setIsLoadingCommand(true);
        setLastResponse(null);
        try {
          console.log(`Sending: ${cmd}`);
          const response = await sendCommand(cmd);
          console.log(`Response: ${response}`);
          setLastResponse(response);
          // !!! IMPORTANT: Parse the 'response' string here !!!
          // e.g., if cmd was '010C', parse 'response' to get RPM
        } catch (err: any) {
          Alert.alert(`Command Error (${cmd})`, err.message);
        } finally {
          setIsLoadingCommand(false);
        }
      };

      // --- Render Logic ---
      const renderDeviceItem = ({ item }: { item: PeripheralWithPrediction }) => (
        <TouchableOpacity
          onPress={() => handleConnect(item)}
          disabled={isConnecting || !!connectedDevice}
          style={{ padding: 10, borderBottomWidth: 1, borderColor: '#ccc', backgroundColor: item.isLikelyOBD ? '#e0ffe0' : 'white' }}
        >
          <Text style={{ fontWeight: 'bold' }}>{item.name || 'Unnamed Device'}</Text>
          <Text>ID: {item.id}</Text>
          <Text>RSSI: {item.rssi} {item.isLikelyOBD ? '(Likely OBD)' : ''}</Text>
        </TouchableOpacity>
      );

      return (
        <ScrollView style={{ flex: 1, padding: 10 }}>
          <View style={{ padding: 10, marginBottom: 10, backgroundColor: '#eee' }}>
            <Text>Bluetooth: {isBluetoothOn ? 'ON' : 'OFF'}</Text>
            <Text>Permissions: {hasPermissions ? 'Granted' : 'Missing'}</Text>
            <Text>Status: {connectedDevice ? `Connected to ${connectedDevice.name || connectedDevice.id}` : 'Disconnected'}</Text>
            {isConnecting && <Text>Connecting...</Text>}
            {error && <Text style={{ color: 'red' }}>Error: {error.message}</Text>}
          </View>

          {!isBluetoothOn && <Button title="Enable Bluetooth" onPress={handleEnableBluetooth} />}
          {!hasPermissions && <Button title="Request Permissions" onPress={handleRequestPermissions} />}

          <View style={{ marginVertical: 10 }}>
            <Button title={isScanning ? 'Scanning...' : 'Scan for Devices (5s)'} onPress={handleScan} disabled={isScanning || !isBluetoothOn || !hasPermissions} />
            {isScanning && <ActivityIndicator style={{ marginTop: 5 }} />}
          </View>

          <Text style={{ fontWeight: 'bold', marginTop: 10 }}>Discovered Devices:</Text>
          <FlatList
            data={discoveredDevices}
            renderItem={renderDeviceItem}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 200, borderWidth: 1, borderColor: 'grey' }} // Limit height for ScrollView
            ListEmptyComponent={<Text style={{ padding: 10, textAlign: 'center' }}>{isScanning ? 'Scanning...' : 'No devices found.'}</Text>}
          />

          {connectedDevice && (
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontWeight: 'bold' }}>Connected Device Actions:</Text>
              <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginVertical: 5}}>
                 <Button title="ATZ (Reset)" onPress={() => handleSendCommand('ATZ')} disabled={isLoadingCommand} />
                 <Button title="ATE0 (Echo Off)" onPress={() => handleSendCommand('ATE0')} disabled={isLoadingCommand} />
                 <Button title="010C (RPM)" onPress={() => handleSendCommand('010C')} disabled={isLoadingCommand} />
                 <Button title="010D (Speed)" onPress={() => handleSendCommand('010D')} disabled={isLoadingCommand} />
              </View>

              {isLoadingCommand && <ActivityIndicator />}
              {lastResponse !== null && (
                 <View style={{marginTop: 10, padding: 5, backgroundColor: '#f0f0f0'}}>
                    <Text style={{fontWeight: 'bold'}}>Last Raw Response:</Text>
                    <Text style={{fontFamily: 'monospace'}}>{lastResponse || 'N/A'}</Text>
                    <Text style={{fontStyle: 'italic', fontSize: 10}}>(Remember to parse this data!)</Text>
                 </View>
              )}

              <Button title="Disconnect" onPress={handleDisconnect} color="red" style={{ marginTop: 10 }} />
            </View>
          )}

        </ScrollView>
      );
    };

    export default YourMainAppComponent;

    ```

## API Reference (`useBluetooth`)

The `useBluetooth` hook returns an object with the following properties:

### State Variables

*   `isBluetoothOn: boolean`: Whether the device's Bluetooth adapter is powered on.
*   `hasPermissions: boolean`: Whether the necessary permissions appeared granted during the last check/request.
*   `isInitializing: boolean`: `true` while the underlying `BleManager` is starting up.
*   `isScanning: boolean`: `true` while a BLE device scan is in progress.
*   `discoveredDevices: PeripheralWithPrediction[]`: An array of discovered BLE peripherals (`Peripheral` object from `react-native-ble-manager` potentially augmented with `isLikelyOBD: boolean`). Cleared when a new scan starts.
*   `isConnecting: boolean`: `true` while attempting to connect to a device.
*   `isDisconnecting: boolean`: `true` while attempting to disconnect from a device.
*   `connectedDevice: Peripheral | null`: The `Peripheral` object of the currently connected device, or `null`.
*   `activeDeviceConfig: ActiveDeviceConfig | null`: Contains the specific Service/Characteristic UUIDs and write type being used for the connected device. `null` if not connected.
*   `isAwaitingResponse: boolean`: `true` if `sendCommand` or `sendCommandRaw` has been called and is waiting for the `>` prompt from the adapter.
*   `isStreaming: boolean`: `true` if the application has indicated (via `setStreaming(true)`) that it intends to perform continuous data polling. Automatically set to `false` after a period of inactivity (~4s) with no successful commands.
*   `lastSuccessfulCommandTimestamp: number | null`: The `Date.now()` timestamp of the last successfully completed command. Used for the streaming inactivity timer.
*   `error: Error | BleError | null`: The last error encountered during operations (permissions, scanning, connection, commands). Cleared automatically on the start of some new operations.

### Functions

*   `checkPermissions(): Promise<boolean>`: Checks the current status of required Bluetooth/Location permissions. Updates `hasPermissions` state and returns `true` if all are granted.
*   `requestBluetoothPermissions(): Promise<boolean>`: Prompts the user to grant the required permissions. Updates `hasPermissions` state and returns `true` if all are granted.
*   `promptEnableBluetooth(): Promise<void>`: On Android, attempts to show the system dialog asking the user to enable Bluetooth. Has no effect on iOS (users must use Settings). Resolves when the prompt is shown or if no action is needed. Rejects on error (e.g., user denial on Android).
*   `scanDevices(scanDurationMs?: number): Promise<void>`: Starts a BLE scan for nearby devices for the specified duration (default: 5000ms). Updates `isScanning` and populates `discoveredDevices`. Resolves when the scan stops. Rejects on error or if prerequisites (BT on, permissions) are not met.
*   `connectToDevice(deviceId: string): Promise<Peripheral>`: Attempts to connect to the specified device ID. Performs smart discovery of ELM327 services/characteristics. Updates `isConnecting`, `connectedDevice`, `activeDeviceConfig`. Resolves with the `Peripheral` object on success. Rejects on failure (timeout, incompatible device, connection error).
*   `disconnect(): Promise<void>`: Disconnects from the currently connected device. Stops notifications. Updates `isDisconnecting`, `connectedDevice`. Resolves on success. Rejects on error.
*   `sendCommand(command: string, options?: { timeout?: number }): Promise<string>`: Sends an AT or OBD command string (without `\r`) to the connected device. Waits for the response ending in `>`. Resolves with the response string (trimmed, without `>`). Rejects on error or timeout (default ~4s, configurable via `options.timeout`).
*   `sendCommandRaw(command: string, options?: { timeout?: number }): Promise<Uint8Array>`: Sends a command like `sendCommand` but resolves with the raw response as a `Uint8Array` (excluding the final `>` byte).
*   `setStreaming(shouldStream: boolean): void`: Informs the library whether the application intends to start (`true`) or stop (`false`) continuous data polling. This controls the `isStreaming` state and the activation of the automatic inactivity timer.

## License

MIT

# Installation

Use Yarn to install dependencies:

```bash
yarn install
```

# Scripts

- **Start**: `yarn start`
- **Build**: `yarn build`
- **Test**: `yarn test`
- **Lint**: `yarn lint`
- **Format**: `yarn format`
