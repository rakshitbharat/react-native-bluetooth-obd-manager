Okay, here is a Markdown section explaining the internal logic of the `disconnect` function in your library. This can be added to a relevant Wiki page (like the API Reference or a dedicated "How it Works" page) to give users a clearer picture of the process.

---

## Internal Logic: What Happens During `disconnect()`?

When you call the `disconnect()` function provided by the `useBluetooth` hook, the library performs a sequence of actions internally to cleanly terminate the connection and update its state. Here's a breakdown of the typical process:

1.  **Check Connection Status:** The library first verifies if there is currently an active connection (`connectedDevice` state is not `null`). If no device is connected, the function usually returns immediately, successfully completing its task (as there's nothing to disconnect).

2.  **Retrieve Connection Details:** If a device is connected, the library retrieves the necessary details stored from the successful connection process. This includes:
    *   The `deviceId` (MAC address or UUID) of the connected peripheral.
    *   The specific `serviceUUID` and `characteristicUUID` that were used for receiving notifications (the ones passed to `BleManager.startNotification` during connection).

3.  **Stop Notifications:** **Crucially**, the library explicitly stops listening for incoming data from the OBD adapter on the relevant characteristic. It calls the underlying `react-native-ble-manager` function:
    ```javascript
    // Internal call example:
    await BleManager.stopNotification(deviceId, serviceUUID, characteristicUUID);
    ```
    This informs the Bluetooth stack that the app is no longer interested in data from this specific characteristic, helping to free up resources.

4.  **Terminate BLE Connection:** The library then requests the operating system to terminate the actual Bluetooth Low Energy link with the peripheral by calling:
    ```javascript
    // Internal call example:
    await BleManager.disconnect(deviceId);
    ```

5.  **Update Internal State:** Once the disconnection command is successfully processed (or initiated) by `BleManager`, the library updates its internal state via its reducer:
    *   The `connectedDevice` state variable is set back to `null`.
    *   Any other internal flags related to the active connection (e.g., `isConnecting`) are reset.

6.  **Return Promise:** The `disconnect()` function, being asynchronous, returns a Promise. This Promise resolves when the disconnection steps (stopping notifications, calling `BleManager.disconnect`, updating state) have been successfully initiated or completed. It rejects if an unexpected error occurs during the process (though errors during disconnection are generally less common than during connection).

**In essence, calling `disconnect()` triggers a clean shutdown sequence:** it stops listening for data, formally terminates the Bluetooth link, and updates the library's state so your application knows the device is no longer connected. This follows standard BLE practices for proper connection management.