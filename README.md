### THIS IS STILL UNDER CONSTRUCTION ###
-
-
-
-
-
-
-
------------
# React Native Bluetooth OBD Manager

[![npm version](https://img.shields.io/npm/v/react-native-bluetooth-obd-manager.svg?style=flat)](https://www.npmjs.com/package/react-native-bluetooth-obd-manager)
[![npm downloads](https://img.shields.io/npm/dm/react-native-bluetooth-obd-manager.svg?style=flat)](https://www.npmjs.com/package/react-native-bluetooth-obd-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- TODO: Add Build Status / Coverage badges here once CI/CD is set up -->

A React Native hook library (`useBluetooth`) designed to simplify Bluetooth Low Energy (BLE) communication with ELM327-compatible OBD-II adapters. It handles device scanning, smart connection (auto-detecting common ELM327 service/characteristic patterns), command execution (AT commands, OBD PIDs), streaming state, and connection management.

**Note:** This library provides the communication layer. Parsing the responses from OBD-II commands (e.g., converting hex strings from PIDs like `010C` into RPM values) is **not** included and must be implemented by your application according to OBD-II standards (SAE J1979).

## Features

*   **Safe Initialization:** Provides `isInitializing` state to safely handle the async initialization of Bluetooth functionality.
*   **Simple Hook Interface:** Manage all BLE OBD interactions via the `useBluetooth` hook.
*   **State Management:** Provides reactive state for Bluetooth power status, permissions, scanning activity, connection status, command status, streaming status, errors, etc.
*   **Permission Handling:** Includes functions to check (`checkPermissions`) and request (`requestBluetoothPermissions`) necessary permissions (Location, Bluetooth Scan/Connect) directly via the hook.
*   **Bluetooth Enabling:** Provides a function (`promptEnableBluetooth`) to prompt the user to enable Bluetooth (Android only).
*   **Device Scanning:** Scan for nearby BLE peripherals (`scanDevices`) with status indication (`isScanning`) and results (`discoveredDevices`). Includes a basic heuristic flag (`isLikelyOBD`) on discovered devices based on name.
*   **Smart Connection:** Automatically attempts to connect (`connectToDevice`) using a list of known Service/Characteristic UUIDs common among ELM327 clones, increasing compatibility.
*   **Command Execution:** Send AT/OBD commands with `sendCommand` (for string responses) or `sendCommandRaw` (for `Uint8Array` responses). Handles:
    *   Automatic write type selection (`Write` vs `WriteWithoutResponse`).
    *   Required command termination (`\r`).
    *   Waiting for ELM327 prompt (`>`) to signal response completion.
    *   Configurable command timeouts.
    *   Error handling for writes, timeouts, and disconnects.
*   **Raw Byte Commands:** Option to send commands and receive the **complete** raw `Uint8Array` response (`sendCommandRaw`) after the `>` prompt is detected.
*   **Chunked Response:** Advanced option to receive responses with preserved packet boundaries (`sendCommandRawChunked`) useful for protocols requiring exact chunk boundaries or line breaks.
*   **Connection Management:** Graceful `connectToDevice` and `disconnect` functions.
*   **Real-time Disconnect Detection:** Automatically updates connection state if the device disconnects unexpectedly.
*   **Streaming Helper State:** Includes state (`isStreaming`) and control (`setStreaming`) managed by the application, plus an **automatic inactivity timeout** (~4s) managed by the library to detect stalled polling loops.
*   **TypeScript Support:** Written entirely in TypeScript with strict typings.

## Installation

1.  **Install Library:**
    ```bash
    npm install react-native-bluetooth-obd-manager
    # or
    yarn add react-native-bluetooth-obd-manager
    ```

2.  **Install Peer Dependencies:** This library requires `react-native-ble-manager` and `react-native-permissions`. You **must** install and configure them natively according to their documentation. **This library will not work without correct native setup of these dependencies.**

    ```bash
    npm install react-native-ble-manager react-native-permissions
    # or
    yarn add react-native-ble-manager react-native-permissions
    ```

    *   **`react-native-ble-manager` Setup:** Carefully follow the official [react-native-ble-manager installation guide](https://github.com/innoveit/react-native-ble-manager#installation). This includes:
        *   iOS: `pod install`, adding `NSBluetoothAlwaysUsageDescription` (or `NSBluetoothPeripheralUsageDescription`) to `Info.plist`.
        *   Android: Adding required permissions (`BLUETOOTH`, `BLUETOOTH_ADMIN` (maxSdk 30), `ACCESS_FINE_LOCATION`, `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`) to `AndroidManifest.xml`. Ensure linking is correct.
    *   **`react-native-permissions` Setup:** Follow the official [react-native-permissions setup guide](https://github.com/zoontek/react-native-permissions#setup). This includes:
        *   iOS: `pod install`, adding relevant `NS...UsageDescription` keys to `Info.plist` (especially `NSLocationWhenInUseUsageDescription` for scanning).
        *   Android: Usually no extra steps needed beyond ensuring the permissions requested exist in `AndroidManifest.xml`.

3.  **Required Permissions (Manifest/Info.plist Examples):**
    *Ensure these (or equivalent) are correctly added as per the peer dependency setup guides.*

    *   **`Info.plist` (iOS):**
        ```xml
        <key>NSBluetoothAlwaysUsageDescription</key> <!-- Or NSBluetoothPeripheralUsageDescription -->
        <string>Allow $(PRODUCT_NAME) to connect to your OBD adapter.</string>
        <key>NSLocationWhenInUseUsageDescription</key>
        <string>Allow $(PRODUCT_NAME) to find nearby Bluetooth OBD adapters.</string>
        ```
    *   **`AndroidManifest.xml` (Android):**
        ```xml
        <!-- Basic Bluetooth (Android 11 and below) -->
        <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
        <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />

        <!-- Location (Needed for BLE scanning, required always before Android 12) -->
        <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
        <!-- Add android:usesPermissionFlags="neverForLocation" to BLUETOOTH_SCAN if you
             don't derive location from scan results and target Android 12+ -->

        <!-- Android 12+ (API 31+) Specific Permissions -->
        <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
        <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

        <!-- Declare Bluetooth features -->
        <uses-feature android:name="android.hardware.bluetooth_le" android:required="true"/>
        ```

## Usage

1.  **Wrap your app with `BluetoothProvider` and handle initialization:**

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

    // YourMainAppComponent.tsx
    import React from 'react';
    import { View, Text, ActivityIndicator } from 'react-native';
    import { useBluetooth } from 'react-native-bluetooth-obd-manager';

    const YourMainAppComponent = () => {
      const { isInitializing } = useBluetooth();

      // Important: Wait for BluetoothProvider to initialize
      if (isInitializing) {
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" />
            <Text>Initializing Bluetooth...</Text>
          </View>
        );
      }

      // Render your main component UI only after initialization is complete
      return (
        <View>
          {/* Your component content */}
        </View>
      );
    };

    export default YourMainAppComponent;
    ```

    **⚠️ Important:** Always check `isInitializing` from the `useBluetooth` hook before using any Bluetooth functionality. The `BluetoothProvider` performs asynchronous initialization of the native Bluetooth module, and your components should wait for this to complete.

2.  **Use the `useBluetooth` hook:**

    ```tsx
    // YourMainAppComponent.tsx
    import React, { useState, useEffect, useCallback, useRef } from 'react';
    import {
      View, Text, Button, FlatList, TouchableOpacity, ActivityIndicator,
      Alert, ScrollView, StyleSheet, Switch
    } from 'react-native';
    import {
      useBluetooth,
      type PeripheralWithPrediction,
      type BleError // Optional: for more specific error type checking
    } from 'react-native-bluetooth-obd-manager';

    const YourMainAppComponent = () => {
      // Get state and functions from the hook
      const {
        isBluetoothOn,
        hasPermissions,
        isInitializing, // <-- Destructure the initializing flag
        isScanning,
        discoveredDevices,
        connectedDevice,
        isConnecting,
        isDisconnecting,
        error,
        isAwaitingResponse,
        isStreaming,
        lastSuccessfulCommandTimestamp,
        checkPermissions,
        requestBluetoothPermissions,
        promptEnableBluetooth,
        scanDevices,
        connectToDevice,
        disconnect,
        sendCommand,
        sendCommandRawChunked,
        sendCommandRaw,
        setStreaming,
      } = useBluetooth();

      const [lastResponse, setLastResponse] = useState<string | null>(null);
      const [lastRawResponse, setLastRawResponse] = useState<Uint8Array | null>(null);
      const [isLoadingCommand, setIsLoadingCommand] = useState(false);
      const [appIsStreaming, setAppIsStreaming] = useState(false); // App's view of streaming

      // Ref for streaming interval
      const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

      // --- Effects ---
      useEffect(() => {
        // Check permissions status on mount
        checkPermissions();
      }, [checkPermissions]);

      // Effect to synchronize app's streaming state with library's state
      // (Handles case where library stops streaming due to inactivity/disconnect)
      useEffect(() => {
        if (!isStreaming && appIsStreaming) {
            console.log("Library stopped streaming (inactivity/disconnect), stopping app interval.");
            if (streamIntervalRef.current) {
                clearInterval(streamIntervalRef.current);
                streamIntervalRef.current = null;
            }
            setAppIsStreaming(false); // Update app state
        }
      }, [isStreaming, appIsStreaming]);

      // Effect to cleanup streaming on unmount
      useEffect(() => {
        return () => {
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
          }
        };
      }, []);


      // --- Handlers ---
      const handleRequestPermissions = useCallback(async () => {
        const granted = await requestBluetoothPermissions();
        if (!granted) { Alert.alert("Permissions Required", "Please grant permissions via Settings."); }
      }, [requestBluetoothPermissions]);

      const handleEnableBluetooth = useCallback(async () => {
         try { await promptEnableBluetooth(); }
         catch (err) { Alert.alert("Enable Bluetooth", "Please enable Bluetooth in device settings."); }
      }, [promptEnableBluetooth]);

      const handleScan = useCallback(async () => {
        if (isScanning) return;
        try { await scanDevices(5000); } // Scan for 5 seconds
        catch (err: any) { Alert.alert('Scan Error', err.message); }
      }, [isScanning, scanDevices]);

      const handleConnect = useCallback(async (device: PeripheralWithPrediction) => {
        if (isConnecting || connectedDevice) return;
        try { await connectToDevice(device.id); Alert.alert('Connected!', `Connected to ${device.name || device.id}`); }
        catch (err: any) { Alert.alert('Connection Error', err.message); }
      }, [isConnecting, connectedDevice, connectToDevice]);

      const handleDisconnect = useCallback(async () => {
        await stopDataStream(); // Use await here
        if (connectedDevice) {
          try { await disconnect(); Alert.alert('Disconnected'); setLastResponse(null); setLastRawResponse(null); }
          catch (err: any) { Alert.alert('Disconnect Error', err.message); }
        }
      }, [connectedDevice, disconnect, stopDataStream]);

      const handleSendCommand = useCallback(async (cmd: string) => {
        if (!connectedDevice) { Alert.alert("Not Connected"); return; }
        setIsLoadingCommand(true); setLastResponse(null); setLastRawResponse(null);
        try {
          const response = await sendCommand(cmd);
          setLastResponse(response);
          // TODO: Parse 'response' string here based on 'cmd'
        } catch (err: any) { Alert.alert(`Command Error (${cmd})`, err.message); }
        finally { setIsLoadingCommand(false); }
      }, [connectedDevice, sendCommand]);

      const handleSendCommandRaw = useCallback(async (cmd: string) => {
        if (!connectedDevice) { Alert.alert("Not Connected"); return; }
        setIsLoadingCommand(true); setLastResponse(null); setLastRawResponse(null);
        try {
          const response = await sendCommandRaw(cmd);
          setLastRawResponse(response);
           console.log(`Raw Response Bytes: [${response.join(', ')}]`);
           // TODO: Parse raw 'response' bytes here
        } catch (err: any) { Alert.alert(`Raw Command Error (${cmd})`, err.message); }
        finally { setIsLoadingCommand(false); }
      }, [connectedDevice, sendCommandRaw]);


      // --- Streaming Logic ---
      const fetchDataForStream = useCallback(async () => {
         // Check app's view of streaming intention AND library's state
         if (!appIsStreaming || !isStreaming || !connectedDevice) {
             console.log("fetchDataForStream: Stopping condition met.");
             await stopDataStream(); // Ensure stopped if condition not met
             return;
         };
         console.log("Stream: Fetching...");
         try {
            // Fetch multiple PIDs - NOTE: sendCommand awaits each response
            // Use shorter timeouts for better responsiveness in streaming
            const rpmResponse = await sendCommand('010C', { timeout: 1500 });
            // TODO: Parse RPM
            const speedResponse = await sendCommand('010D', { timeout: 1500 });
            // TODO: Parse Speed
            setLastResponse(`RPM: ${rpmResponse} | Speed: ${speedResponse}`); // Update UI
            // Library automatically updates lastSuccessfulCommandTimestamp internally
         } catch (err: any) {
             console.error("Streaming fetch error:", err.message);
             // Library's inactivity timer will eventually stop isStreaming if errors persist.
             // The effect monitoring isStreaming will then stop the app's interval.
         }
      }, [appIsStreaming, isStreaming, connectedDevice, sendCommand, stopDataStream]);

      // Function called by button/switch to START polling
      const startDataStream = useCallback(() => {
         if (!connectedDevice || appIsStreaming || streamIntervalRef.current) return;
         console.log("Starting data stream...");
         setAppIsStreaming(true); // Update app state
         setStreaming(true); // Signal intention to library
         // Fetch immediately then start interval
         fetchDataForStream();
         streamIntervalRef.current = setInterval(fetchDataForStream, 1000); // Adjust interval as needed
      }, [connectedDevice, appIsStreaming, setStreaming, fetchDataForStream]);

      // Function called by button/switch to STOP polling
      const stopDataStream = useCallback(async () => { // Made async for potential await inside
         if (streamIntervalRef.current) {
            console.log("Stopping data stream...");
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
         }
         // Always update app state and library state when explicitly stopping
         setAppIsStreaming(false);
         setStreaming(false); // Signal stop intention to library

      }, [setStreaming]);


      // --- Render Device Item ---
      const renderDeviceItem = ({ item }: { item: PeripheralWithPrediction }) => (
        <TouchableOpacity
          onPress={() => handleConnect(item)}
          disabled={isConnecting || !!connectedDevice}
          style={[styles.listItem, {backgroundColor: item.isLikelyOBD ? '#e0ffe0' : 'white'}]}
        >
          <Text style={{ fontWeight: 'bold' }}>{item.name || 'Unnamed Device'}</Text>
          <Text>ID: {item.id}</Text>
          <Text>RSSI: {item.rssi} {item.isLikelyOBD ? '(Likely OBD)' : ''}</Text>
        </TouchableOpacity>
      );


      // --- Main Render ---
      // Add the check for isInitializing
      if (isInitializing) {
        return (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
            <Text>Initializing Bluetooth...</Text>
          </View>
        );
      }

      // Render the rest of the component only when not initializing
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          {/* Status Section */}
          <View style={styles.statusBox}>
            <Text>Bluetooth: {isBluetoothOn ? 'ON' : 'OFF'}</Text>
            <Text>Permissions: {hasPermissions ? 'Granted' : 'Missing'}</Text>
            <Text>Status: {connectedDevice ? `Connected to ${connectedDevice.name || connectedDevice.id}` : 'Disconnected'}</Text>
            {isConnecting && <Text style={styles.infoText}>Connecting...</Text>}
            {isDisconnecting && <Text style={styles.infoText}>Disconnecting...</Text>}
            {error && <Text style={styles.errorText}>Error: {(error as Error)?.message ?? 'Unknown error'}</Text>}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            {!isBluetoothOn && <Button title="Enable Bluetooth" onPress={handleEnableBluetooth} />}
            {!hasPermissions && <Button title="Request Permissions" onPress={handleRequestPermissions} />}
            <Button title={isScanning ? 'Scanning...' : 'Scan Devices (5s)'} onPress={handleScan} disabled={isScanning || !isBluetoothOn || !hasPermissions || !!connectedDevice} />
          </View>

          {/* Discovered Devices List */}
          {!connectedDevice && (isScanning || discoveredDevices.length > 0) ? (
            <>
              <Text style={styles.sectionTitle}>Discovered Devices:</Text>
              <FlatList
                data={discoveredDevices}
                renderItem={renderDeviceItem}
                keyExtractor={(item) => item.id}
                style={styles.list}
                ListEmptyComponent={isScanning ? <ActivityIndicator style={{ marginVertical: 20 }}/> : <Text style={styles.emptyList}>No devices found.</Text>}
              />
            </>
          ) : null}


          {/* Connected Device Section */}
          {connectedDevice && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connected: {connectedDevice.name || connectedDevice.id}</Text>

              {/* Basic Commands */}
              <Text style={styles.subSectionTitle}>Send Commands:</Text>
              <View style={styles.buttonGrid}>
                 <Button title="ATZ" onPress={() => handleSendCommand('ATZ')} disabled={isLoadingCommand || isAwaitingResponse} />
                 <Button title="ATE0" onPress={() => handleSendCommand('ATE0')} disabled={isLoadingCommand || isAwaitingResponse} />
                 <Button title="010C (RPM)" onPress={() => handleSendCommand('010C')} disabled={isLoadingCommand || isAwaitingResponse} />
                 <Button title="010D (Speed)" onPress={() => handleSendCommand('010D')} disabled={isLoadingCommand || isAwaitingResponse} />
                 <Button title="ATDPN (Raw)" onPress={() => handleSendCommandRaw('ATDPN')} disabled={isLoadingCommand || isAwaitingResponse} />
              </View>
              {(isLoadingCommand || isAwaitingResponse) && <ActivityIndicator style={{ marginTop: 5 }} />}

              {/* Response Display */}
              {lastResponse !== null && (
                 <View style={styles.responseBox}>
                    <Text style={styles.responseTitle}>Last String Response:</Text>
                    <Text style={styles.responseText}>{lastResponse || 'N/A'}</Text>
                    <Text style={styles.parseNote}>(Remember to parse this data!)</Text>
                 </View>
              )}
               {lastRawResponse !== null && (
                 <View style={styles.responseBox}>
                    <Text style={styles.responseTitle}>Last Raw Response (Bytes):</Text>
                    <Text style={styles.responseText}>{`[${lastRawResponse.join(', ')}]`}</Text>
                 </View>
              )}

              {/* Streaming Controls */}
               <Text style={styles.subSectionTitle}>Real-time Data:</Text>
               <Text>Status: {appIsStreaming ? `Polling Active` : 'Polling Inactive'} {isStreaming && appIsStreaming ? `(Library OK - Last OK: ${lastSuccessfulCommandTimestamp ? new Date(lastSuccessfulCommandTimestamp).toLocaleTimeString() : 'N/A'})` : isStreaming && !appIsStreaming ? '(Library thinks active?)' : ''}</Text>
               <View style={styles.buttonGroup}>
                   <Button title="Start Polling" onPress={startDataStream} disabled={appIsStreaming || isLoadingCommand || isAwaitingResponse} />
                   <Button title="Stop Polling" onPress={stopDataStream} disabled={!appIsStreaming} />
               </View>

              {/* Disconnect */}
              <Button title="Disconnect" onPress={handleDisconnect} color="red" disabled={isDisconnecting} />
            </View>
          )}

        </ScrollView>
      );
    };

    // Basic Styling
    const styles = StyleSheet.create({
      container: { flex: 1 },
      contentContainer: { padding: 15, paddingBottom: 50 }, // Added padding bottom
      centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
      statusBox: { padding: 10, marginBottom: 10, backgroundColor: '#f0f0f0', borderRadius: 5, borderWidth: 1, borderColor: '#ddd'},
      infoText: { fontStyle: 'italic', color: '#333'},
      errorText: { color: 'red', marginTop: 5, fontWeight: 'bold' },
      buttonGroup: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginVertical: 10, flexWrap: 'wrap', gap: 10 },
      buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 5, gap: 10},
      sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
      subSectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 10, marginBottom: 5 },
      list: { maxHeight: 250, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 10 },
      listItem: { padding: 10, borderBottomWidth: 1, borderColor: '#eee'},
      emptyList: { padding: 15, textAlign: 'center', fontStyle: 'italic', color: '#777' },
      section: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
      responseBox: { marginTop: 10, padding: 8, backgroundColor: '#e8f4f8', borderRadius: 3, borderWidth: 1, borderColor: '#c7e0e8' },
      responseTitle: { fontWeight: 'bold' },
      responseText: { fontFamily: 'monospace', marginTop: 3 },
      parseNote: { fontStyle: 'italic', fontSize: 10, color: '#555', marginTop: 2 },
    });

    export default YourMainAppComponent;
    ```

## API Reference (`useBluetooth`)

The `useBluetooth` hook provides the primary interface for interacting with Bluetooth OBD adapters. It returns an object containing the current state and functions to perform actions.

### State Variables

*   `isBluetoothOn: boolean`: Indicates if the device's Bluetooth adapter is currently powered ON. Updates automatically based on system events.
*   `hasPermissions: boolean`: Reflects the status of required Bluetooth/Location permissions based on the last call to `checkPermissions` or `requestBluetoothPermissions`. `true` indicates necessary permissions appeared granted.
*   `isInitializing: boolean`: `true` while the underlying native `BleManager` module is being initialized on app start. Your UI might want to wait for this to become `false`.
*   `isScanning: boolean`: `true` if a BLE device scan initiated by `scanDevices()` is currently in progress.
*   `discoveredDevices: PeripheralWithPrediction[]`: An array containing discovered BLE devices. Each object is a `Peripheral` (from `react-native-ble-manager`) potentially augmented with an `isLikelyOBD: boolean` flag based on device name heuristics. This array is cleared when a new scan starts and populated during the scan.
*   `isConnecting: boolean`: `true` while an attempt to connect to a device via `connectToDevice()` is in progress.
*   `isDisconnecting: boolean`: `true` while `disconnect()` is executing.
*   `connectedDevice: Peripheral | null`: Holds the `Peripheral` object of the currently connected OBD adapter, or `null` if no device is connected. This is the source of truth for connection status.
*   `activeDeviceConfig: ActiveDeviceConfig | null`: If connected, contains the specific BLE `serviceUUID`, `writeCharacteristicUUID`, `notifyCharacteristicUUID`, and determined `writeType` ('Write' or 'WriteWithoutResponse') being used for communication. `null` otherwise.
*   `isAwaitingResponse: boolean`: `true` when `sendCommand` or `sendCommandRaw` has been called and the library is actively waiting for the response terminator (`>`) from the adapter. Use this to prevent sending concurrent commands.
*   `isStreaming: boolean`: Reflects the intended streaming state set by `setStreaming()` **and** whether the library's automatic inactivity timer has stopped it. `true` means the app intends to poll data and the library hasn't detected inactivity. `false` means streaming is off or was stopped due to inactivity/disconnect. Monitor this state in your app to synchronize your polling loop.
*   `lastSuccessfulCommandTimestamp: number | null`: The `Date.now()` timestamp marking the completion of the last successful command (string or raw). Used by the streaming inactivity timer. `null` if no commands have succeeded recently or streaming is off.
*   `error: Error | BleError | null`: Holds the last error object encountered during any operation (permissions, scan, connect, command, etc.). Can be checked to display error messages. It's often cleared when a new operation starts.

### Functions

*   `checkPermissions(): Promise<boolean>`
    *   Checks the current status of required Bluetooth and Location permissions based on the platform and OS version.
    *   Updates the `hasPermissions` state.
    *   Returns `true` if all necessary permissions are currently granted, `false` otherwise.
*   `requestBluetoothPermissions(): Promise<boolean>`
    *   Initiates the native system prompts to request necessary Bluetooth and Location permissions.
    *   Updates the `hasPermissions` state based on the user's response.
    *   Returns `true` if all necessary permissions were granted by the user, `false` otherwise. Note: If permissions are `BLOCKED`, returns `false`, and the user must manually enable them in device settings.
*   `promptEnableBluetooth(): Promise<void>`
    *   On **Android**, attempts to trigger the system dialog asking the user to turn on Bluetooth. Resolves when the prompt is dismissed or Bluetooth is enabled. Rejects if the user denies the request or an error occurs.
    *   On **iOS**, this function has no effect (logs a warning). Users must enable Bluetooth via Settings/Control Center. Resolves immediately.
*   `scanDevices(scanDurationMs?: number): Promise<void>`
    *   Starts a BLE scan for nearby peripherals.
    *   Checks prerequisites (Bluetooth ON, Permissions Granted). Throws error if not met.
    *   `scanDurationMs` (optional, default: 5000): Duration of the scan in milliseconds.
    *   Sets `isScanning` to `true` and clears `discoveredDevices`.
    *   Populates `discoveredDevices` as devices are found.
    *   Resolves when the scan stops (either by duration or manually). Rejects on scan initiation error.
*   `connectToDevice(deviceId: string): Promise<Peripheral>`
    *   Attempts to establish a BLE connection to the device with the given ID.
    *   Performs "smart discovery" by iterating through `KNOWN_ELM327_TARGETS` to find compatible service/characteristic UUIDs.
    *   Determines the correct write type (`Write` or `WriteWithoutResponse`).
    *   Starts notifications for the response characteristic.
    *   Updates `isConnecting`, `connectedDevice`, `activeDeviceConfig` state.
    *   Resolves with the connected `Peripheral` object on success.
    *   Rejects on failure (incompatible device, connection timeout, service discovery error, notification error). Attempts cleanup via `disconnect` on failure.
*   `disconnect(): Promise<void>`
    *   Disconnects from the currently connected device.
    *   Stops notifications on the characteristic.
    *   Updates `isDisconnecting` state. The `connectedDevice` state becomes `null` via the internal disconnect event listener.
    *   Resolves when the disconnection process is successfully initiated. Rejects on error during the disconnection attempt.
*   `sendCommand(command: string, options?: { timeout?: number }): Promise<string>`
    *   Sends an AT or OBD command string to the connected device. **Do not include `\r`**.
    *   `options.timeout` (optional, default: ~4000ms): Custom timeout in milliseconds for waiting for the `>` response terminator for this specific command.
    *   Automatically appends `\r`, selects the correct BLE write method, waits for the **complete response** ending in `>`, and handles timeouts.
    *   Updates `lastSuccessfulCommandTimestamp` on success.
    *   Resolves with the trimmed response **string** (excluding `>`).
    *   Rejects on error (not connected, command pending, write error, timeout, disconnect during command).
*   `sendCommandRaw(command: string, options?: { timeout?: number }): Promise<Uint8Array>`
    *   Identical to `sendCommand` in operation (sends command, waits for `>`), but resolves with the **complete** raw response as a **`Uint8Array`** (excluding the final `>` byte). Useful for non-ASCII or binary responses where exact byte values are needed.
    *   Updates `lastSuccessfulCommandTimestamp` on success.
    *   Rejects on error (not connected, command pending, write error, timeout, disconnect during command).
*   `sendCommandRawChunked(command: string, options?: { timeout?: number }): Promise<ChunkedResponse>`
    *   Similar to `sendCommandRaw`, but preserves the original data packet boundaries as received from the BLE characteristic.
    *   Returns a `ChunkedResponse` object containing:
        *   `data: Uint8Array` - The complete flattened response (excluding the prompt byte)
        *   `chunks: Uint8Array[]` - Array of individual response chunks with preserved boundaries
    *   Useful when protocol-specific line breaks or packet boundaries must be preserved (e.g., multiline DTC responses).
    *   Updates `lastSuccessfulCommandTimestamp` on success.
    *   Rejects on error (not connected, command pending, write error, timeout, disconnect during command).
*   `setStreaming(shouldStream: boolean): void`
    *   Allows the application to signal its intent to start (`true`) or stop (`false`) continuous data polling.
    *   Updates the library's internal `isStreaming` state flag.
    *   Setting to `true` resets the `lastSuccessfulCommandTimestamp` and **enables** the library's internal inactivity timer (~4 seconds).
    *   Setting to `false` **disables** the inactivity timer and clears the timestamp. Your application should call this when *explicitly* stopping its polling loop.

## Important Notes

*   **Initialization Handling:** Components using the `useBluetooth` hook **must** check the `isInitializing` state before accessing any Bluetooth functionality. This is critical because:
    * The `BluetoothProvider` needs time to initialize the native Bluetooth module
    * Attempting to use Bluetooth functions before initialization is complete may cause errors
    * Always render a loading state when `isInitializing` is `true`
    * Only render your main component UI after `isInitializing` becomes `false`

*   **Native Setup:** Correctly installing and configuring `react-native-ble-manager` and `react-native-permissions` for both iOS and Android is **essential** for this library to function. Refer to their official documentation.
*   **PID Parsing:** This library **does not parse** OBD-II responses. Your application needs to implement the logic to convert the string (from `sendCommand`) or byte (from `sendCommandRaw`) responses into meaningful data based on the requested PID and OBD-II standards (SAE J1979).
*   **Error Handling:** Always wrap function calls (`scanDevices`, `connectToDevice`, `sendCommand`, etc.) in `try...catch` blocks or use `.catch()` on the returned promises to handle potential errors gracefully. Check the `error` state variable for persistent errors.
*   **Concurrency:** The library prevents sending a new command while `isAwaitingResponse` is true. Ensure your application logic respects this flag or queues commands appropriately.
*   **Data Buffering:** Both `sendCommand` and `sendCommandRaw` internally buffer incoming data chunks from the BLE device. They only resolve their respective Promises **after** the complete response (signalled by the `>` character) has been received or a timeout occurs. For preserving exact packet boundaries, use `sendCommandRawChunked`.
*   **Streaming State Synchronization:** The application should manage its own polling interval (`setInterval`). Use `setStreaming(true)` when starting the interval and `setStreaming(false)` when clearing it. Monitor the `isStreaming` state from the hook; if it becomes `false` unexpectedly (due to inactivity timeout or disconnect), your application should clear its own interval timer.

## License

MIT
