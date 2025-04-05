Okay, here is the Markdown documentation explaining how a user should **use** the `sendCommand` function in their application.

---

## Usage Guide: Sending OBD Commands (`sendCommand`)

The `sendCommand` function is the core method for interacting with a connected ELM327 adapter. It allows you to send both AT configuration commands and standard OBD-II commands (PIDs) to query vehicle data. It simplifies the process by handling the command transmission and waiting for the complete response.

**Prerequisites:**

*   You must be **connected** to an OBD adapter using `connectToDevice`. Check that the `connectedDevice` state from `useBluetooth` is not `null`.

**Function Signature:**

```typescript
sendCommand(command: string, options?: { timeout?: number }): Promise<string>
```

**Parameters:**

1.  **`command: string`** (Required):
    *   The AT command or OBD-II PID you want to send (e.g., `'ATZ'`, `'ATE0'`, `'010C'`, `'03'`).
    *   **Important:** Do *not* typically include the carriage return (`\r`) yourself; the library usually appends it automatically as required by ELM327.
2.  **`options?: { timeout?: number }`** (Optional):
    *   An optional object for specifying advanced settings.
    *   `timeout` (number): Allows you to override the default command timeout (usually ~4000ms) for *this specific command* in **milliseconds**. Use this cautiously if you know a particular command takes longer on your vehicle/adapter setup (e.g., `{ timeout: 6000 }` for a 6-second timeout).

**Returns:**

*   **`Promise<string>`**: An asynchronous Promise that will eventually:
    *   **Resolve** with a `string` containing the **complete response** received from the OBD adapter (excluding the final `>` prompt character) if the command executes successfully before timing out.
    *   **Reject** with an `Error` object if:
        *   No device is connected.
        *   The command times out (doesn't receive the complete response ending in `>` within the timeout period).
        *   A Bluetooth communication error occurs during transmission or while waiting for the response.
        *   Another command is already in progress (if the library doesn't queue commands).

**Basic Usage with `async/await`:**

The recommended way to use `sendCommand` is with `async/await` inside an `async` function, wrapped in a `try...catch` block to handle potential errors.

```typescript
import React, { useState } from 'react';
import { View, Button, Text, TextInput, Alert } from 'react-native';
import { useBluetooth } from 'react-native-bluetooth-obd-manager';

const CommandTester = () => {
  const { sendCommand, connectedDevice } = useBluetooth();
  const [commandToSend, setCommandToSend] = useState<string>('010C'); // Example: Engine RPM
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCommand = async () => {
    if (!connectedDevice) {
      Alert.alert("Error", "Not connected to any device.");
      return;
    }
    if (!commandToSend.trim()) {
      Alert.alert("Error", "Please enter a command.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setLastResponse(null);
    console.log(`Sending command: "${commandToSend}"...`);

    try {
      // --- Using sendCommand ---
      const response = await sendCommand(commandToSend);
      // --- Success ---

      console.log(`Received response:`, response);
      setLastResponse(response);
      Alert.alert("Command Success", `Response:\n${response}`);

      // !!! IMPORTANT: Parse the 'response' string here to get meaningful data !!!
      // Example: if command was '010C', parse the hex bytes in 'response'
      // const rpmValue = parseRpmResponse(response);

    } catch (err: any) {
      // --- Error Handling ---
      console.error(`Command "${commandToSend}" failed:`, err);
      setError(`Error: ${err.message}`); // Display the error message
      Alert.alert("Command Failed", `Error sending "${commandToSend}":\n${err.message}`);
      // Check specifically for timeouts if needed
      if (err.message?.toLowerCase().includes('timeout')) {
        console.warn('Consider checking connection or vehicle responsiveness.');
      }
    } finally {
      // --- Cleanup ---
      setIsLoading(false);
    }
  };

  return (
    <View style={{ padding: 10 }}>
      <Text>Enter AT or OBD Command:</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: 'gray', padding: 8, marginVertical: 10 }}
        value={commandToSend}
        onChangeText={setCommandToSend}
        autoCapitalize="characters"
        placeholder="e.g., ATZ, 010D"
        editable={!isLoading && !!connectedDevice}
      />
      <Button
        title={isLoading ? 'Sending...' : `Send: ${commandToSend}`}
        onPress={handleSendCommand}
        disabled={isLoading || !connectedDevice}
      />

      {isLoading && <Text>Waiting for response...</Text>}
      {error && <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>}
      {lastResponse !== null && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontWeight: 'bold' }}>Raw Response:</Text>
          {/* Displaying raw response - remember to parse it */}
          <Text style={{ fontFamily: 'monospace' }}>{lastResponse || 'N/A'}</Text>
        </View>
      )}
    </View>
  );
};

export default CommandTester;
```

**Common Commands to Try:**

*   `ATZ` (Reset adapter - good first command)
*   `ATE0` (Turn echo off - recommended for cleaner responses)
*   `ATSP0` (Set protocol to Auto)
*   `0100` (Show supported PIDs [01-20])
*   `010C` (Engine RPM)
*   `010D` (Vehicle Speed km/h)
*   `0105` (Engine Coolant Temp °C)
*   `03` (Show stored Diagnostic Trouble Codes - DTCs)
*   `04` (Clear stored DTCs - Use with extreme caution!)

**Parsing the Response:**

Remember that `sendCommand` returns the **raw string response** from the adapter (e.g., `"41 0C 1A F0"`). You need to write code to parse this string according to the OBD-II standard (SAE J1979) to convert the hexadecimal data into meaningful values (like RPM, speed in km/h, temperature in °C, etc.). The specific formula depends on the PID requested. Refer to OBD-II PID documentation online.