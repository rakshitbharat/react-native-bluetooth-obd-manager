Okay, here is the Markdown file summarizing the features confirmed or assumed to be **Implemented** in the `react-native-bluetooth-obd-manager` library, based on the core design requirements and functionalities discussed. This serves as the counterpart to the "TODO" list.

---

# Implemented Library Features

This document outlines the core features and functionalities provided "out-of-the-box" by the `react-native-bluetooth-obd-manager` library, accessible primarily through the `useBluetooth` hook.

---

## I. Core Setup and State Management

*   **`BluetoothProvider` Component:**
    *   The root component required to wrap your application (or relevant parts).
    *   Initializes the Bluetooth context, manages internal state, and sets up necessary listeners for the underlying `react-native-ble-manager`.
*   **`useBluetooth` Hook:**
    *   The primary interface for interacting with the library.
    *   Provides access to all state variables and action functions described below.
*   **Centralized State:**
    *   Manages Bluetooth status, permissions, scanning state, connection status, and discovered devices within a React Context, ensuring consistent state across components using the hook.

---

## II. Bluetooth State and Permission Checking

*   **`isBluetoothOn: boolean` State:**
    *   Real-time status indicating if the device's Bluetooth adapter is currently powered ON or OFF. Automatically updated based on system events.
*   **`hasPermissions: boolean` State:**
    *   Indicates if the necessary Bluetooth/Location permissions *appeared* granted during the library's last check.
*   **`checkPermissions(): Promise<boolean>` Function:**
    *   Allows manual triggering of a permission status re-check, updating the `hasPermissions` state. Essential to call after your application has handled the *initial permission request* (which is currently external to the library - see TODO).

---

## III. Device Discovery (Scanning)

*   **`scanDevices(scanDuration?: number): Promise<void>` Function:**
    *   Initiates a BLE scan for nearby peripherals.
    *   Accepts an optional duration (in milliseconds).
    *   Handles prerequisite checks (Bluetooth ON, Permissions Granted, Not Already Scanning).
*   **`isScanning: boolean` State:**
    *   Real-time flag indicating if a device scan is currently in progress (`true`) or not (`false`).
*   **`discoveredDevices: Peripheral[]` State:**
    *   An array holding the `Peripheral` objects (from `react-native-ble-manager`) found during the scan.
    *   Cleared when a new scan starts. Populated progressively during the scan. Contains the final list when the scan completes.

---

## IV. Connection Management

*   **`connectToDevice(deviceId: string): Promise<Peripheral>` Function:**
    *   Establishes a connection to the specified peripheral ID.
    *   **Smart ELM327 Discovery:** Implements internal logic to automatically search for common BLE Service and Characteristic UUIDs used by various ELM327 clones, enhancing compatibility.
    *   **Automatic Write Method Selection:** Detects whether the connected device's characteristic supports `Write` (with response) or only `WriteWithoutResponse` and stores this for use by `sendCommand`.
*   **`connectedDevice: Peripheral | null` State:**
    *   Holds the `Peripheral` object of the currently connected device, or `null` if no device is connected. This is the single source of truth for connection status.
*   **Real-Time Disconnection Detection:**
    *   The library listens internally for unexpected disconnection events from the system.
    *   If the active device disconnects unexpectedly (e.g., power loss, out of range), the `connectedDevice` state is automatically updated to `null`, allowing your application to react via `useEffect`.

---

## V. Command Execution

*   **`sendCommand(command: string, options?: { timeout?: number }): Promise<string>` Function:**
    *   Sends an AT or OBD command string to the connected device.
    *   **Handles `\r` Termination:** Automatically appends carriage return as needed for ELM327.
    *   **Uses Auto-Selected Write Method:** Internally calls `BleManager.write` or `BleManager.writeWithoutResponse` based on the method determined during connection.
    *   **Waits for `>` Terminator:** Monitors the incoming data stream (via the internal global listener) and waits for the `>` character to signal the end of the response.
    *   **Returns Response String:** Resolves the Promise with the complete response string (excluding `>`) upon success.
    *   **Built-in Command Timeout:** Rejects the Promise if the `>` terminator isn't received within the specified or default timeout period (e.g., ~4 seconds).
    *   **Error Handling:** Rejects the Promise on connection errors, BLE write errors, or timeouts.

---

## VI. Disconnection

*   **`disconnect(): Promise<void>` Function:**
    *   Gracefully terminates the connection to the currently active device.
    *   **Stops Notifications:** Internally calls `BleManager.stopNotification` for the relevant characteristic.
    *   **Disconnects Peripheral:** Internally calls `BleManager.disconnect`.
    *   **Updates State:** Sets the `connectedDevice` state back to `null`.

---

These implemented features provide the foundation for building React Native applications that communicate with ELM327 OBD-II adapters, handling many of the low-level Bluetooth complexities automatically. Refer to the specific documentation for each function/state variable for detailed usage examples.