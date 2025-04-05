Okay, let's document the internal logic for the `scanDevices` function.

---

## Internal Logic: `scanDevices` Execution Flow

The `scanDevices(scanDuration?)` function, exposed via the `useBluetooth` hook, initiates the process of discovering nearby Bluetooth Low Energy (BLE) peripherals, specifically searching for potential OBD adapters. Here’s how it typically works behind the scenes within the library:

1.  **Prerequisite Checks:**
    *   Before attempting to scan, the function rigorously checks several conditions within the library's current state:
        *   **Bluetooth Power:** Is `state.isBluetoothOn` true?
        *   **Permissions:** Is `state.hasPermissions` true? (Ensuring necessary `BLUETOOTH_SCAN`, `ACCESS_FINE_LOCATION`, etc., are granted).
        *   **Already Scanning?** Is `state.isScanning` already `true`? If so, it might prevent starting a new scan immediately (or it might stop the previous one first, depending on implementation choice).
    *   If any of these checks fail, the Promise returned by `scanDevices` is immediately **rejected** with an appropriate error message (e.g., "Bluetooth is off," "Permissions missing," "Scan already in progress").

2.  **Initiate Scan State:**
    *   If prerequisites are met, an action (e.g., `SCAN_START`) is dispatched to the library's reducer.
    *   The reducer updates the internal state:
        *   Sets `state.isScanning = true`.
        *   Clears the existing `state.discoveredDevices` array to prepare for new results.

3.  **Configure Scan Parameters:**
    *   The `scanDuration` provided by the user (or a default value, e.g., 5000ms) is converted into seconds as required by `BleManager.scan`.
    *   Scan options are prepared. Typically, this involves scanning for *all* services (`[]`) to discover any type of BLE device initially. Options often include `allowDuplicates: false` to simplify the results list by reporting each device only once during the scan period.

4.  **Activate `BleManager` Listeners (If Not Global):**
    *   The library ensures that the necessary event listeners from `react-native-ble-manager` are active *before* starting the scan. Crucially, this includes:
        *   `BleManagerDiscoverPeripheral`: Fires each time a unique device is found.
        *   `BleManagerStopScan`: Fires when the scan finishes (either due to duration expiring or manual stop).
    *   **Note:** In many implementations (including likely this one, based on previous discussions), these listeners might be set up *globally* once by the `BluetoothProvider` and remain active, rather than being added/removed for each scan.

5.  **Start BLE Scan:**
    *   The core scanning operation is initiated by calling the underlying library:
    ```javascript
    // Internal call example:
    BleManager.scan([], scanDurationInSeconds, false /* allowDuplicates */)
      .then(() => {
        console.log('BleManager scan initiated successfully.');
        // The scan is now running in the background for the specified duration
      })
      .catch((error) => {
        console.error('BleManager scan initiation failed:', error);
        // If starting fails, need to reject the promise and reset state
        dispatch({ type: 'SCAN_FAILURE', payload: error });
        // Reject the original scanDevices promise here
      });
    ```
    *   If the `BleManager.scan` call itself fails immediately (e.g., due to an underlying OS issue), the `.catch` block handles it, dispatches a failure action to the reducer (which sets `isScanning = false`), and rejects the `scanDevices` Promise.

6.  **Handle Discovered Devices (`BleManagerDiscoverPeripheral` Listener):**
    *   While the scan is active, the `BleManagerDiscoverPeripheral` listener receives events.
    *   For each `peripheral` object received from the event:
        *   An action (e.g., `DEVICE_FOUND`) is dispatched with the `peripheral` data.
        *   The reducer handles this action by adding the `peripheral` object to the `state.discoveredDevices` array. (It might include logic to prevent adding exact duplicates if `allowDuplicates` was true, but usually `allowDuplicates: false` in the `scan` call handles this).

7.  **Handle Scan Completion (`BleManagerStopScan` Listener):**
    *   When the scan duration expires, `BleManager` automatically stops the scan and fires the `BleManagerStopScan` event.
    *   The listener for this event triggers:
        *   An action (e.g., `SCAN_STOP`) is dispatched.
        *   The reducer handles this action by setting `state.isScanning = false`.
        *   Crucially, the resolution of the **original Promise** returned by the user-facing `scanDevices` function is typically tied to this event. Once the state is updated to reflect the scan stopping, the Promise resolves successfully (usually with `void`).

**Summary of Outcome:**

Calling `scanDevices` triggers a controlled process: it checks prerequisites, updates the library's state to indicate scanning is active, uses `react-native-ble-manager` to perform the actual BLE scan for a set duration, collects discovered devices into the state via listeners, and finally updates the state again when the scan completes, resolving the Promise returned to the user. The `isScanning` and `discoveredDevices` state variables provided by the `useBluetooth` hook reflect the real-time progress and results of this internal flow.