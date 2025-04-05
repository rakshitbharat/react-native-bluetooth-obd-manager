Okay, here is the Markdown specifically outlining the Bluetooth-related setup features that are identified as **TODO** items for the `useBluetooth` hook, necessary to ensure users don't need direct access to underlying libraries like `BleManager` or `react-native-permissions`.

---

## TODO / Planned Bluetooth Setup Features for `useBluetooth` Hook

To ensure the library provides a fully self-contained interface for essential Bluetooth setup operations, the following wrapper functions need to be implemented and exposed directly via the `useBluetooth` hook:

### 1. `promptEnableBluetooth()` Function

*   **Requirement:** Provide a function within the `useBluetooth` hook that allows the application to trigger the native system prompt asking the user to enable Bluetooth if it's currently off. This avoids forcing users to import and call `BleManager.enableBluetooth()` directly.
*   **Proposed Signature:** `promptEnableBluetooth(): Promise<void>`
*   **Internal Implementation:** This function needs to safely call `BleManager.enableBluetooth()` internally, primarily targeting Android, while handling potential errors and the lack of an equivalent API on iOS gracefully.
*   **Status:** **TODO** - Currently, users wanting this functionality might need to call `BleManager` directly (which is against the desired constraints) or only guide users to settings.

### 2. `requestBluetoothPermissions()` Function

*   **Requirement:** Provide a function within the `useBluetooth` hook that handles the entire process of requesting the necessary Bluetooth and Location permissions (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION`, `NSBluetoothPeripheralUsageDescription`, etc.) based on the specific platform and OS version. This avoids forcing users to import and manage `react-native-permissions` themselves for core Bluetooth setup.
*   **Proposed Signature:** `requestBluetoothPermissions(): Promise<boolean>`
*   **Internal Implementation:** This function needs to:
    *   Use `react-native-permissions` internally.
    *   Determine the correct set of permissions to request.
    *   Call `requestMultiple` or `request`.
    *   Interpret the results to determine if all *essential* permissions were granted.
    *   Automatically trigger an internal update (like calling `checkPermissions`) to refresh the `hasPermissions` state.
    *   Return `true` if successful, `false` otherwise.
*   **Status:** **TODO** - Currently, the library relies on the user application performing permission requests externally before using the library's core features.

---

Implementing these two functions directly within the `useBluetooth` hook will make the library more self-sufficient and align with the goal of abstracting away the underlying dependencies from the end-user for basic Bluetooth setup tasks.