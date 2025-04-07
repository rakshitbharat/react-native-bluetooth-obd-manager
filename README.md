# React Native Bluetooth OBD Manager

[![npm version](https://img.shields.io/npm/v/react-native-bluetooth-obd-manager.svg?style=flat)](https://www.npmjs.com/package/react-native-bluetooth-obd-manager)
[![npm downloads](https://img.shields.io/npm/dm/react-native-bluetooth-obd-manager.svg?style=flat)](https://www.npmjs.com/package/react-native-bluetooth-obd-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- Add Build Status / Coverage badges here once CI/CD is set up -->

A React Native hook library (`useBluetooth`) designed to simplify Bluetooth Low Energy (BLE) communication with ELM327-compatible OBD-II adapters. It handles device scanning, smart connection (auto-detecting common ELM327 service/characteristic patterns), command execution (AT commands, OBD PIDs), streaming state, and connection management.

**Note:** This library provides the communication layer. Parsing the responses from OBD-II commands (e.g., converting hex strings from PIDs like `010C` into RPM values) is **not** included and must be implemented by your application according to OBD-II standards (SAE J1979).

## Features

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

1.  **Wrap your app with `BluetoothProvider`:**

    ```tsx
    // App.tsx or similar entry point
    import React from 'react';
    import { BluetoothProvider } from 'react-native-bluetooth-obd-manager';
    import YourMainAppComponent from './YourMainAppComponent'; // Your main app component

    const App = () => {
      // Ensure BleManager and Permissions native modules are linked correctly!
      return (
        <BluetoothProvider>
          <YourMainAppComponent />
        </BluetoothProvider>
      );
    };

    export default App;
    ```

2.  **Use the `useBluetooth` hook:**

    ```tsx
    // YourMainAppComponent.tsx
    import React, { useState, useEffect, useCallback, useRef } from 'react';
    // ... other imports ...
    import { useBluetooth, type PeripheralWithPrediction, type BleError } from 'react-native-bluetooth-obd-manager';

    const YourMainAppComponent = () => {
      const { /* ... get state and functions from useBluetooth ... */
        sendCommand,
        sendCommandRaw,
        /* ... */
      } = useBluetooth();

      // ... state for UI ...
      // ... effects ...
      // ... handlers for permissions, scan, connect, disconnect ...

      const handleSendCommand = useCallback(async (cmd: string) => { /* ... as before ... */ }, [connectedDevice, sendCommand]);
      const handleSendCommandRaw = useCallback(async (cmd: string) => { /* ... as before ... */ }, [connectedDevice, sendCommandRaw]);
      const startDataStream = useCallback(() => { /* ... as before ... */ }, [connectedDevice, isStreaming, setStreaming, fetchDataForStream]);
      const stopDataStream = useCallback(() => { /* ... as before ... */ }, [isStreaming, setStreaming]);
      const fetchDataForStream = useCallback(async () => { /* ... as before ... */ }, [connectedDevice, isStreaming, sendCommand, stopDataStream]);

      // ... render logic ...

      return ( /* ... JSX ... */ );
    };

    export default YourMainAppComponent;

    // Example Usage Snippet:
    // <Button title="ATDPN (Raw)" onPress={() => handleSendCommandRaw('ATDPN')} disabled={isLoadingCommand || isAwaitingResponse} />
    // {lastRawResponse !== null && (
    //    <View>
    //       <Text>Last Raw Response (Bytes):</Text>
    //       <Text>{`[${lastRawResponse.join(', ')}]`}</Text>
    //    </View>
    // )}

    ```
    *(For full example component, see previous response or example app)*

## API Reference (`useBluetooth`)

The `useBluetooth` hook provides the primary interface for interacting with Bluetooth OBD adapters. It returns an object containing the current state and functions to perform actions.

### State Variables

*(State variable descriptions remain the same as previous README)*

*   `isBluetoothOn: boolean`
*   `hasPermissions: boolean`
*   `isInitializing: boolean`
*   `isScanning: boolean`
*   `discoveredDevices: PeripheralWithPrediction[]`
*   `isConnecting: boolean`
*   `isDisconnecting: boolean`
*   `connectedDevice: Peripheral | null`
*   `activeDeviceConfig: ActiveDeviceConfig | null`
*   `isAwaitingResponse: boolean`
*   `isStreaming: boolean`
*   `lastSuccessfulCommandTimestamp: number | null`
*   `error: Error | BleError | null`

### Functions

*(Descriptions for checkPermissions, requestBluetoothPermissions, promptEnableBluetooth, scanDevices, connectToDevice, disconnect, setStreaming remain the same)*

*   `checkPermissions(): Promise<boolean>`
*   `requestBluetoothPermissions(): Promise<boolean>`
*   `promptEnableBluetooth(): Promise<void>`
*   `scanDevices(scanDurationMs?: number): Promise<void>`
*   `connectToDevice(deviceId: string): Promise<Peripheral>`
*   `disconnect(): Promise<void>`
*   `sendCommand(command: string, options?: { timeout?: number }): Promise<string>`
    *   Sends an AT or OBD command string (without `\r`) to the connected device.
    *   `options.timeout` (optional, default: ~4000ms): Custom timeout in milliseconds for waiting for the `>` response terminator for this specific command.
    *   Automatically appends `\r`, selects the correct BLE write method, waits for the **complete response** ending in `>`, and handles timeouts.
    *   Updates `lastSuccessfulCommandTimestamp` on success.
    *   Resolves with the trimmed response **string** (excluding `>`).
    *   Rejects on error (not connected, command pending, write error, timeout, disconnect during command).
*   `sendCommandRaw(command: string, options?: { timeout?: number }): Promise<Uint8Array>`
    *   Identical to `sendCommand` in operation (sends command, waits for `>`), but resolves with the **complete** raw response as a **`Uint8Array`** (excluding the final `>` byte). <!-- CHANGED -->
    *   Useful for non-ASCII or binary responses where exact byte values are needed.
    *   Updates `lastSuccessfulCommandTimestamp` on success.
    *   Rejects on error (not connected, command pending, write error, timeout, disconnect during command).
*   `setStreaming(shouldStream: boolean): void`

## Important Notes

*   **Native Setup:** Correctly installing and configuring `react-native-ble-manager` and `react-native-permissions` for both iOS and Android is **essential** for this library to function. Refer to their official documentation.
*   **PID Parsing:** This library **does not parse** OBD-II responses. Your application needs to implement the logic to convert the string (from `sendCommand`) or byte (from `sendCommandRaw`) responses into meaningful data based on the requested PID and OBD-II standards (SAE J1979).
*   **Error Handling:** Always wrap function calls (`scanDevices`, `connectToDevice`, `sendCommand`, etc.) in `try...catch` blocks or use `.catch()` on the returned promises to handle potential errors gracefully. Check the `error` state variable for persistent errors.
*   **Concurrency:** The library prevents sending a new command while `isAwaitingResponse` is true. Ensure your application logic respects this flag or queues commands appropriately.
*   <!-- ADDED -->**Data Buffering:** Both `sendCommand` and `sendCommandRaw` internally buffer incoming data chunks from the BLE device. They only resolve their respective Promises **after** the complete response (signalled by the `>` character) has been received or a timeout occurs. The library does **not** currently provide a mechanism to receive raw data in chunks as it arrives from the BLE characteristic.

## License

MIT
