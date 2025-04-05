Okay, here is the consolidated final Markdown file listing all the features identified as **TODO / Planned Enhancements** for the `react-native-bluetooth-obd-manager` library, based on our discussion.

# TODO / Planned Library Enhancements

This document outlines planned features and enhancements for the `react-native-bluetooth-obd-manager` library, aimed at improving usability, flexibility, and providing a more self-contained experience.

---

## I. Bluetooth Setup & Permissions (within `useBluetooth` Hook)

These enhancements focus on abstracting essential setup steps so users do not need to import underlying libraries (`BleManager`, `react-native-permissions`) directly.

### 1. `promptEnableBluetooth()` Function

*   **Requirement:** Provide a function within the `useBluetooth` hook to directly trigger the system prompt asking the user to enable Bluetooth if it's currently off.
*   **Need:** Avoids forcing users to import `BleManager` for this common setup step, especially on Android.
*   **Proposed Hook Addition:** `promptEnableBluetooth(): Promise<void>`
*   **Internal Action:** Will wrap `BleManager.enableBluetooth()`, handling platform differences (no-op/error on iOS) and errors gracefully.
*   **Status:** **TODO**

### 2. `requestBluetoothPermissions()` Function

*   **Requirement:** Provide a function within the `useBluetooth` hook to handle the requesting of necessary Bluetooth/Location permissions based on platform and OS version.
*   **Need:** Simplifies setup by abstracting `react-native-permissions` usage for core Bluetooth requirements.
*   **Proposed Hook Addition:** `requestBluetoothPermissions(): Promise<boolean>`
*   **Internal Action:** Will internally use `react-native-permissions` to request the correct permission set, interpret the results, update the library's `hasPermissions` state, and return an overall success/failure boolean.
*   **Status:** **TODO**

---

## II. Device Discovery & Identification

Enhancements related to the scanning process and the data provided for discovered devices.

### 3. Predictive `isLikelyOBD` Flag in Scan Results

*   **Requirement:** Automatically add a boolean flag (e.g., `isLikelyOBD`) to the `Peripheral` objects within the `discoveredDevices` state array.
*   **Need:** Helps the UI easily identify and highlight potential OBD adapters based on common naming conventions, reducing frontend boilerplate.
*   **Proposed Data Structure Change:** `discoveredDevices` state becomes `Array<Peripheral & { isLikelyOBD: boolean }>`
*   **Internal Action:** Requires adding heuristic logic (checking `peripheral.name` for keywords like "OBD", "ELM", etc.) within the library's scan result processing before updating the state.
*   **Status:** **TODO**

---

## III. Command Handling (`sendCommand`)

Improvements related to the flexibility of sending commands and receiving responses.

### 4. Raw Byte Array Response from Commands

*   **Requirement:** Provide an option or a separate function to allow users to receive the raw `Uint8Array` response directly from the adapter, bypassing the default string decoding.
*   **Need:** Essential for handling non-ASCII/binary data, custom byte-level parsing, or low-level debugging. Avoids unreliable string-to-byte conversions by the user.
*   **Proposed Options:**
    *   `sendCommand(command, { returnType: 'bytes' })` (Option on existing function)
    *   `sendCommandRaw(command)` (New dedicated function)
*   **Internal Action:** Requires modifying `sendCommand`'s internal logic to buffer raw bytes, check for the byte terminator (`0x3E`), and conditionally return bytes or the decoded string.
*   **Status:** **TODO**

---

## IV. High-Level State Management for Continuous Polling ("Streaming")

Features to help manage application-level logic for continuous data fetching.

### 5. `isStreaming` State Flag

*   **Requirement:** Provide a boolean state variable directly from the `useBluetooth` hook (`isStreaming`) indicating if continuous data polling is considered active by the library.
*   **Need:** Offers a centralized flag, controllable by the user and the library's inactivity logic, to track the state of ongoing data fetching operations.
*   **Proposed Hook Addition:** `isStreaming: boolean` (Read-only state)
*   **Internal Action:** Requires adding `isStreaming` to the library's state context.
*   **Status:** **TODO**

### 6. `setStreaming()` Function

*   **Requirement:** Provide a function (`setStreaming`) in the `useBluetooth` hook for users to explicitly signal when they are starting (`true`) or stopping (`false`) their continuous data polling loop.
*   **Need:** Allows the user application to inform the library about the intended state of polling activity, enabling the library's inactivity monitoring.
*   **Proposed Hook Addition:** `setStreaming(shouldStream: boolean): void`
*   **Internal Action:** Requires adding reducer logic to update the `isStreaming` state and potentially manage the inactivity timer (start/stop).
*   **Status:** **TODO**

### 7. Automatic Streaming Inactivity Timeout

*   **Requirement:** Automatically set the library's `isStreaming` state to `false` if no `sendCommand` call completes successfully for a defined period (e.g., 4 seconds) while `isStreaming` is intended to be `true`.
*   **Need:** Provides a safety net to automatically reflect when a polling loop has likely stalled or failed due to persistent communication errors, without requiring complex timeout logic solely in the user's application.
*   **Proposed Behavior:** Library monitors command success timestamps while `isStreaming` is true.
*   **Internal Action:** Requires adding `lastSuccessfulCommandTimestamp` state, modifying `sendCommand` success path to update it, and implementing an internal timer to check for inactivity and dispatch an action to set `isStreaming = false` if the threshold is met.
*   **Status:** **TODO**

---

These planned enhancements aim to make `react-native-bluetooth-obd-manager` a more comprehensive and user-friendly solution for developing React Native OBD applications.