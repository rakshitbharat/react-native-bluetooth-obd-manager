Okay, here is the consolidated Markdown documentation detailing the complete internal logic of the `sendCommand` function, incorporating all the aspects we've discussed (automatic write type selection, timeout, `>` handling, global listener reliance, `isStreaming` timestamp update).

---

## Internal Logic: The Complete `sendCommand` Execution Flow

The `sendCommand(command, options)` function is the primary method for interacting with the connected ELM327 adapter. It's designed to handle the complexities of Bluetooth communication, providing a straightforward way to send a command and receive its response. Here’s a comprehensive step-by-step breakdown of the internal process when you call `await sendCommand(...)`:

1.  **Prerequisite Checks:**
    *   **Connection Check:** The function first verifies that a device is currently connected by checking the internal state (`state.connectedDevice` is not `null`). If not connected, it immediately rejects the Promise with an error message like "No device connected."
    *   **Command-in-Progress Check (Optional):** Depending on the implementation (whether commands are queued or only one allowed at a time), it might check an internal flag like `state.isAwaitingResponse`. If this flag is already `true`, it might reject with an error like "Another command is already in progress."

2.  **Retrieve Active Connection Details:**
    *   It accesses the configuration details stored when the current device was successfully connected. This configuration includes:
        *   `deviceId`: The unique identifier of the connected peripheral.
        *   `serviceUUID`: The UUID of the BLE service used for communication.
        *   `writeCharacteristicUUID`: The UUID of the characteristic used to send commands.
        *   `notifyCharacteristicUUID`: The UUID of the characteristic used to receive responses.
        *   **`writeType`**: The specific method (`'Write'` or `'WriteWithoutResponse'`) determined during connection based on the characteristic's properties.

3.  **Prepare for Response Handling & Timeout:**
    *   **Set "Awaiting Response" State:** An internal flag, `state.isAwaitingResponse`, is set to `true`. This indicates the library is now actively listening for the response terminating with the `>` character.
    *   **Initialize Response Buffer:** A temporary, internal buffer is cleared or created to accumulate incoming data chunks for this specific command execution.
    *   **Start Command Timeout Timer:** A `setTimeout` timer is initiated.
        *   The duration is set by `options.timeout` (if provided), otherwise defaulting to the library's standard timeout (e.g., 4000ms).
        *   If this timer expires before the complete response (including `>`) is received, it will trigger the timeout failure logic (see Step 7).

4.  **Format and Convert Command:**
    *   The input `command` string (e.g., `"010C"`) is formatted for ELM327 transmission, typically by appending a carriage return (`\r`). Example: `"010C"` becomes `"010C\r"`.
    *   The resulting string is converted into the appropriate byte format (e.g., `Uint8Array`, `number[]`) required by the `react-native-ble-manager` write functions.

5.  **Transmit Command (Automatic Write Type Selection):**
    *   This step uses the `writeType` retrieved in Step 2 to choose the correct BLE write method:
    *   **If `writeType` is `'Write'`:** It calls `BleManager.write(deviceId, serviceUUID, writeCharacteristicUUID, commandBytes, ...)`.
    *   **If `writeType` is `'WriteWithoutResponse'`:** It calls `BleManager.writeWithoutResponse(deviceId, serviceUUID, writeCharacteristicUUID, commandBytes, ...)`.
    *   This entire operation is wrapped in a `try...catch` block to handle immediate errors during the BLE write attempt (e.g., characteristic not found, connection dropped just before writing). If an error occurs here, the process jumps to the error handling in Step 7.

6.  **Monitor Global Listener for Response Data:**
    *   The function **does not start a new listener**. It relies on the **pre-existing global notification listener** (managed by `BluetoothProvider`) that is always listening for data on the `notifyCharacteristicUUID` of the connected device.
    *   As data chunks arrive asynchronously via this global listener:
        *   The internal logic checks if `state.isAwaitingResponse` is `true` (meaning *this specific* `sendCommand` call is waiting).
        *   If yes, the incoming data chunk is appended to the temporary response buffer created in Step 3.
        *   After appending, the buffer is checked to see if it now contains the ELM327 termination prompt (`>`). If the `>` is found, the process moves to the success path in Step 7.

7.  **Handle Completion (Success, Timeout, or Error):** The waiting period initiated in Step 3 ends when one of the following occurs:

    *   **A. Success (`>` Received):**
        *   Triggered when the check in Step 6 detects the `>` in the response buffer.
        *   The complete response string is extracted from the buffer (excluding the final `>`).
        *   The command-specific timeout timer (from Step 3) is **cleared** (`clearTimeout`).
        *   The internal `state.isAwaitingResponse` flag is set to `false`.
        *   **(For `isStreaming` Feature):** The `state.lastSuccessfulCommandTimestamp` is updated to `Date.now()`.
        *   The `sendCommand` Promise is **resolved** with the extracted response string.

    *   **B. Command Timeout (Timer Expires):**
        *   Triggered by the `setTimeout` timer (from Step 3) firing before the `>` was received.
        *   The internal `state.isAwaitingResponse` flag is set to `false`.
        *   The `sendCommand` Promise is **rejected** with a specific `TimeoutError` (or an error message indicating a timeout).
        *   *(The timer implicitly clears itself by firing)*.

    *   **C. BLE Error (During Write or Wait):**
        *   Triggered by an error during the `write` call (Step 5) or if the global listener detects a critical error (like disconnection) while waiting.
        *   The command-specific timeout timer (from Step 3) is **cleared**.
        *   The internal `state.isAwaitingResponse` flag is set to `false`.
        *   The `sendCommand` Promise is **rejected** with the relevant error object or message.

**Summary of Outcome:**

When you use `await sendCommand(...)`, the library orchestrates this entire internal flow. It automatically selects the correct write method, sends the command, monitors incoming data via the global listener, waits specifically for the `>` termination character, handles its own timeout, updates internal state flags (including the timestamp for the optional `isStreaming` feature), and finally returns either the complete response string upon success or throws an error upon failure or timeout. This provides a robust and relatively simple interface for complex underlying operations.