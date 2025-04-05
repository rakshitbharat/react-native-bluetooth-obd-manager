Okay, let's formulate a plan to build the `react-native-bluetooth-obd-manager` library from scratch based on your requirements and the provided Markdown documentation.

**Goal:** Create a high-quality, strictly-typed, well-tested React Native library that provides a `useBluetooth` hook to simplify BLE communication with ELM327-compatible OBD-II adapters. The library acts as a wrapper around `react-native-ble-manager` and `react-native-permissions`, handling state management and common interaction patterns. Users are responsible for installing and setting up the underlying dependencies. The library *will not* include specific PID parsing functions (like `getRpm`).

**Core Dependencies (User Installs/Sets Up):**

1.  `react-native-ble-manager`
2.  `react-native-permissions`
3.  `convert-string` (Likely for specific byte<->string conversions, potentially needed internally)
4.  `text-encoding` (Polyfill, might be needed for older RN versions or specific encoding tasks)

**Library Dependencies (Internal):**

*   React
*   TypeScript

**Development Plan:**

**Phase 0: Project Setup & Tooling (Foundation for Quality)**

1.  **Initialize Project:** Use a robust template like `react-native-builder-bob` to create the library structure.
    ```bash
    npx react-native-builder-bob create react-native-bluetooth-obd-manager
    ```
2.  **Install Dependencies:**
    *   Add core React/React Native peer dependencies.
    *   Add `convert-string` and potentially `text-encoding` as *direct* dependencies if the library needs them internally for specific conversions beyond basic UTF8. (Re-evaluate necessity during implementation).
3.  **Configure TypeScript:** Set up `tsconfig.json` with strict settings (`strict: true`, `noImplicitAny: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, etc.). Ensure declaration files are generated.
4.  **Configure ESLint & Prettier:**
    *   Use a strict ESLint config (e.g., `@react-native-community/eslint-config` combined with TypeScript ESLint plugins: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`). Enforce rules like explicit return types, naming conventions, etc.
    *   Set up Prettier for automatic code formatting.
    *   Integrate with lint-staged and Husky for pre-commit hooks to enforce formatting and linting.
5.  **Configure Testing:**
    *   Set up Jest with `ts-jest`.
    *   Configure testing utilities (e.g., `@testing-library/react-native` for potential hook testing, Jest's mocking capabilities).

**Phase 1: Core Structure & State Management**

1.  **Define Types (`src/types.ts`):**
    *   `BluetoothState`: Interface defining the shape of the context state (e.g., `isBluetoothOn`, `hasPermissions`, `isScanning`, `discoveredDevices`, `connectedDevice`, `isConnecting`, `isDisconnecting`, `isStreaming`, `lastSuccessfulCommandTimestamp`, `error`, `activeDeviceConfig`).
    *   `BluetoothAction`: Discriminated union of all possible actions for the reducer.
    *   `ActiveDeviceConfig`: Interface storing the discovered service/characteristic UUIDs and write type for the connected device.
    *   `PeripheralWithPrediction`: Extend `Peripheral` from `react-native-ble-manager` to include `isLikelyOBD`.
    *   Define signatures for functions exposed by the hook.
2.  **Implement Reducer (`src/BluetoothReducer.ts`):**
    *   Create the reducer function that takes `state` and `action` and returns the new state.
    *   Implement initial state.
    *   Add cases for basic state resets and error handling. (Specific action cases will be added in subsequent phases).
3.  **Implement Context (`src/BluetoothContext.ts`):**
    *   Create the React context (`BluetoothStateContext`, `BluetoothDispatchContext`).
4.  **Implement Provider (`src/BluetoothProvider.tsx`):**
    *   Component that wraps the application.
    *   Initializes `useReducer` with the `BluetoothReducer` and initial state.
    *   Sets up **global** `BleManager` event listeners (e.g., `BleManagerDidUpdateState`, `BleManagerDisconnectPeripheral`, `BleManagerDiscoverPeripheral`, `BleManagerStopScan`, `BleManagerDidUpdateValueForCharacteristic`) within `useEffect` hooks.
        *   These listeners will dispatch actions to the reducer (e.g., update `isBluetoothOn`, set `connectedDevice` to null on disconnect, add device on discovery, handle incoming data).
    *   Provides the state and dispatch function via the context providers.
    *   Handles initialization of `BleManager` (`BleManager.start`).
    *   Includes cleanup logic for listeners on unmount.
5.  **Implement Hook (`src/useBluetooth.ts`):**
    *   Provides the primary interface for users.
    *   Uses `useContext` to access state and dispatch.
    *   Exposes read-only state variables (e.g., `isBluetoothOn`, `connectedDevice`, `isScanning`, `discoveredDevices`, `hasPermissions`, `isStreaming`).
    *   Exposes action functions (these will initially just dispatch placeholder actions until implemented in later phases).

**Phase 2: Bluetooth Status & Permissions**

1.  **Implement Bluetooth State Listener:** Ensure the `BleManagerDidUpdateState` listener in `BluetoothProvider` correctly dispatches an action to update `state.isBluetoothOn`.
2.  **Implement `checkPermissions()`:**
    *   Add function to `useBluetooth`.
    *   Internally calls `react-native-permissions`' `checkMultiple` or individual `check` for required permissions (Android: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION`; iOS: `NSBluetoothPeripheralUsageDescription` - check is implicit, potentially `NSLocationWhenInUseUsageDescription`).
    *   Dispatches action to update `state.hasPermissions` based on the result. Returns the boolean result.
3.  **Implement `requestBluetoothPermissions()`:**
    *   Add function to `useBluetooth`.
    *   Internally calls `react-native-permissions`' `requestMultiple` or individual `request`.
    *   Interprets results, dispatches action to update `state.hasPermissions`. Returns boolean indicating if *all* required permissions were granted.
4.  **Implement `promptEnableBluetooth()`:**
    *   Add function to `useBluetooth`.
    *   Internally calls `BleManager.enableBluetooth()` (primarily for Android).
    *   Handles potential errors and platform differences (no-op/log on iOS).

**Phase 3: Device Discovery (Scanning)**

1.  **Implement `scanDevices(scanDuration?)`:**
    *   Add function to `useBluetooth`.
    *   Performs prerequisite checks (`isBluetoothOn`, `hasPermissions`, not `isScanning`). Rejects promise if checks fail.
    *   Dispatches `SCAN_START` action (reducer sets `isScanning=true`, clears `discoveredDevices`).
    *   Calls `BleManager.scan` with appropriate parameters (e.g., `allowDuplicates: false`).
    *   Handles potential errors from `BleManager.scan`.
    *   The actual discovery happens via the global `BleManagerDiscoverPeripheral` listener.
    *   The scan stop happens via the global `BleManagerStopScan` listener.
2.  **Implement Device Discovery Listener:**
    *   The `BleManagerDiscoverPeripheral` listener in `BluetoothProvider`:
        *   Runs the heuristic check (e.g., checking `peripheral.name` for keywords like "OBD", "ELM", etc.).
        *   Creates the `PeripheralWithPrediction` object.
        *   Dispatches `DEVICE_FOUND` action with the enhanced peripheral object.
    *   Reducer handles `DEVICE_FOUND`: Adds the device to `state.discoveredDevices` (ensuring uniqueness by ID).
3.  **Implement Scan Stop Listener:**
    *   The `BleManagerStopScan` listener in `BluetoothProvider`:
        *   Dispatches `SCAN_STOP` action.
    *   Reducer handles `SCAN_STOP`: Sets `state.isScanning = false`.
    *   The `scanDevices` promise should resolve when the `SCAN_STOP` action is processed (this requires some mechanism like an internal promise resolver map tied to actions).

**Phase 4: Connection & Disconnection**

1.  **Define Constants (`src/constants.ts`):** Store `KNOWN_ELM327_TARGETS` array with common Service/Characteristic UUID combinations.
2.  **Implement `connectToDevice(deviceId)`:**
    *   Add function to `useBluetooth`.
    *   Dispatches `CONNECT_START` action (reducer sets `isConnecting=true`, clears `error`).
    *   Performs the core logic (likely in an async helper function called by the reducer or context):
        *   `BleManager.connect(deviceId)`.
        *   `BleManager.retrieveServices(deviceId)`.
        *   Loop through `KNOWN_ELM327_TARGETS`:
            *   Check if service exists on peripheral.
            *   Check if required characteristics exist (using `peripheralInfo.characteristics`).
            *   If match found:
                *   Determine `writeType` ('Write' vs 'WriteWithoutResponse') based on characteristic properties.
                *   `BleManager.startNotification(...)` for the notify characteristic.
                *   Store the found configuration (`service`, `writeChar`, `notifyChar`, `writeType`) in `activeDeviceConfig`.
                *   Break loop.
        *   If compatible config found: Dispatch `CONNECT_SUCCESS` with peripheral info and `activeDeviceConfig`. Reducer sets `connectedDevice`, `activeDeviceConfig`, `isConnecting=false`. Resolve the `connectToDevice` promise.
        *   If no compatible config found: `BleManager.disconnect(deviceId)`. Dispatch `CONNECT_FAILURE` with error. Reducer sets `error`, `isConnecting=false`. Reject the `connectToDevice` promise.
        *   Handle errors throughout the process, ensuring disconnect and state reset.
3.  **Implement Real-Time Disconnection Listener:**
    *   The `BleManagerDisconnectPeripheral` listener in `BluetoothProvider`:
        *   Checks if the disconnected `peripheral.id` matches `state.connectedDevice?.id`.
        *   If yes, dispatches `DEVICE_DISCONNECTED` action.
    *   Reducer handles `DEVICE_DISCONNECTED`: Sets `connectedDevice = null`, `activeDeviceConfig = null`, potentially `isStreaming = false`, clears related state.
4.  **Implement `disconnect()`:**
    *   Add function to `useBluetooth`.
    *   Checks if `connectedDevice` exists.
    *   Dispatches `DISCONNECT_START` action (reducer sets `isDisconnecting=true`).
    *   Retrieves `deviceId`, `serviceUUID`, `notifyCharUUID` from `state.activeDeviceConfig`.
    *   Calls `BleManager.stopNotification(...)`.
    *   Calls `BleManager.disconnect(deviceId)`.
    *   Dispatches `DISCONNECT_SUCCESS` action (can potentially be triggered by the `BleManagerDisconnectPeripheral` listener implicitly, or explicitly after the `disconnect` call). Reducer sets `connectedDevice=null`, `activeDeviceConfig=null`, `isDisconnecting=false`. Resolve the `disconnect` promise.
    *   Handle errors during disconnection.

**Phase 5: Command Execution**

1.  **Implement Global Notification Listener:**
    *   The `BleManagerDidUpdateValueForCharacteristic` listener in `BluetoothProvider` is crucial.
    *   It receives raw data (`event.value`).
    *   It needs to decode this data (likely using `text-encoding` or built-in methods for simple ASCII/UTF8) and potentially buffer it if responses are split.
    *   It dispatches a `DATA_RECEIVED` action with the decoded string chunk.
2.  **Implement `sendCommand(command, options?)`:**
    *   Add function to `useBluetooth`.
    *   Prerequisite checks (`connectedDevice`).
    *   Retrieve active connection details (`deviceId`, `serviceUUID`, `writeCharUUID`, `writeType`) from `state.activeDeviceConfig`.
    *   Dispatch `SEND_COMMAND_START` action (reducer might set an `isAwaitingResponse` flag, clear previous response buffer).
    *   Set up a command-specific timeout (`setTimeout`) using `options.timeout` or default.
    *   Format command (append `\r`). Convert to bytes (e.g., using `convert-string`).
    *   Call `BleManager.write` or `BleManager.writeWithoutResponse` based on `writeType`, using the byte array.
    *   Handle potential write errors.
    *   **Response Handling:** This is tricky. The function needs to `await` the arrival of the `>` terminator. This likely involves:
        *   Creating a temporary promise specifically for this command's response.
        *   The reducer, upon receiving `DATA_RECEIVED` actions, appends data to a temporary buffer *associated with the pending command*.
        *   When the buffer contains `>`, the reducer resolves the temporary promise with the complete response (minus `>`), clears the timeout, updates `lastSuccessfulCommandTimestamp`, and resets the `isAwaitingResponse` flag.
        *   If the command timeout fires first, it rejects the temporary promise and resets the flag.
    *   Return the promise that resolves/rejects based on the response handling.
3.  **Implement `sendCommandRaw(command, options?)` (or option):**
    *   Similar to `sendCommand`, but the response handling part differs:
        *   Buffers the raw `event.value` (`number[]` or `Uint8Array`).
        *   Checks for the byte `0x3E` (`>`).
        *   Resolves the internal promise with the complete raw byte array.

**Phase 6: Streaming Logic**

1.  **Implement `isStreaming` State:** Add `isStreaming: boolean` and `lastSuccessfulCommandTimestamp: number | null` to `BluetoothState`.
2.  **Implement `setStreaming(shouldStream)`:**
    *   Add function to `useBluetooth`.
    *   Dispatches `SET_STREAMING_STATUS` action with payload `shouldStream`.
    *   Reducer updates `state.isStreaming`. If `true`, potentially resets timestamp and starts the inactivity timer. If `false`, stops the timer.
3.  **Update `sendCommand` Success Path:** Ensure the reducer logic for command success (resolving the internal promise) also updates `state.lastSuccessfulCommandTimestamp = Date.now()`.
4.  **Implement Inactivity Monitor:**
    *   Within `BluetoothProvider`, use `useEffect` to manage an interval timer (`setInterval`) that runs *only* when `state.isStreaming` is true.
    *   The interval callback checks `if (Date.now() - state.lastSuccessfulCommandTimestamp > 4000)`.
    *   If inactive, it dispatches `STREAMING_INACTIVITY_TIMEOUT`.
    *   Reducer handles `STREAMING_INACTIVITY_TIMEOUT` by setting `state.isStreaming = false` and clearing the timestamp.
    *   Ensure the timer is cleared when `isStreaming` becomes `false` or on unmount.

**Phase 7: Testing**

1.  **Mock Dependencies:** Create comprehensive mocks for `react-native-ble-manager` (mocking all functions like `start`, `scan`, `connect`, `retrieveServices`, `write`, `startNotification`, etc., and simulating events like `BleManagerDidUpdateState`, `BleManagerDiscoverPeripheral`, `BleManagerDisconnectPeripheral`, `BleManagerDidUpdateValueForCharacteristic`) and `react-native-permissions` (mocking `check`, `request`, `checkMultiple`, `requestMultiple`).
2.  **Unit Tests:**
    *   Test the `BluetoothReducer` thoroughly for all action types and state transitions.
    *   Test utility functions.
3.  **Integration/Hook Tests:**
    *   Use `@testing-library/react-native` to test the `useBluetooth` hook within the `BluetoothProvider`.
    *   Simulate sequences: check permissions -> request permissions -> scan -> connect -> send command (success/fail/timeout) -> stream -> disconnect.
    *   Test all exposed state variables and functions.
    *   Test error handling paths.
    *   Test edge cases (Bluetooth off, permissions denied, connection fail, unexpected disconnect, scan fail, write fail).
    *   Test the `isLikelyOBD` logic.
    *   Test the raw command response.
    *   Test the streaming logic (manual start/stop, automatic timeout).

**Phase 8: Documentation & Cleanup**

1.  **TSDoc:** Add clear TSDoc comments to all exported types, functions, hook values, and the provider component.
2.  **README.md:**
    *   Installation instructions (including peer deps setup for `BleManager` and `Permissions`).
    *   Basic usage example with `BluetoothProvider` and `useBluetooth`.
    *   Detailed API documentation for the hook's return values (state and functions).
    *   Examples for common flows (scan, connect, send command, stream).
    *   Explain the `isLikelyOBD` flag and its limitations.
    *   Explain the streaming logic (`isStreaming`, `setStreaming`, auto-timeout).
    *   Troubleshooting tips.
    *   Contribution guidelines.
3.  **Code Review & Refinement:** Ensure code consistency, adherence to ESLint/Prettier rules, clarity, and performance. Remove console logs.

**Phase 9: Packaging & Release**

1.  **Configure `package.json`:** Set up main entry point, types entry point, peer dependencies, keywords, repository link, etc.
2.  **Build:** Use `react-native-builder-bob` build scripts.
3.  **(Optional) Publish:** Publish the package to npm.

This detailed plan provides a roadmap for building the library with a focus on quality, testing, and implementing all the features discussed in the Markdown files. Remember to iterate and test frequently throughout the development process.