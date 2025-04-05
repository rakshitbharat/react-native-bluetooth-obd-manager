Yes, absolutely. Detecting unexpected disconnections in real-time is a fundamental requirement for a stable Bluetooth library, and the design relies on mechanisms provided by the underlying `react-native-ble-manager`.

**Confirmation:**

**Yes, the library inherently provides a mechanism for real-time disconnection detection.**

**Mechanism:**

1.  **Underlying Event Listener:** `react-native-ble-manager` provides a crucial event listener, typically named something like `BleManagerDisconnectPeripheral`. This event is fired by the native Bluetooth stack whenever an established connection to a peripheral is lost unexpectedly (e.g., device powered off, out of range, Bluetooth turned off on the phone).
2.  **Library's Global Listener:** Your `react-native-bluetooth-obd-manager` library (specifically, likely within the `BluetoothProvider` setup) subscribes to this `BleManagerDisconnectPeripheral` event when it initializes.
3.  **State Update on Event:** When the library's listener receives this disconnection event:
    *   It checks if the ID of the disconnected peripheral matches the ID of the device currently stored in the library's `connectedDevice` state.
    *   If they match, it means the *active* device has just disconnected unexpectedly.
    *   The listener then dispatches an action (e.g., `DEVICE_UNEXPECTED_DISCONNECT`) to the library's reducer.
    *   The reducer updates the library's state, crucially setting `state.connectedDevice = null`. It might also reset other related flags like `isStreaming` or `isAwaitingResponse`.
4.  **User Notification via State Change:** You, as the user of the library, are notified of this disconnection **by observing the `connectedDevice` state variable provided by the `useBluetooth` hook.** When this state variable changes from a `Peripheral` object back to `null`, it signifies that the connection has ended, whether initiated manually via `disconnect()` or due to an unexpected event.

**No Separate Flag/Listener Needed for User:**

You don't need a separate "real-time disconnection listener" or a specific "disconnected unexpectedly" flag from the hook. The single source of truth is the `connectedDevice` state:

*   If `connectedDevice` is an object, you are connected.
*   If `connectedDevice` is `null`, you are disconnected (for any reason).

---

## Markdown Documentation

Here's the documentation explaining this to the user:

# Handling Real-Time Disconnections

It's essential for your application to react appropriately if the connection to the OBD adapter is lost unexpectedly (e.g., the adapter loses power, goes out of range, or phone's Bluetooth is turned off). The library handles the detection of these events automatically and reflects the change through the `connectedDevice` state.

**Automatic Detection Mechanism:**

1.  **Internal Listener:** The `react-native-bluetooth-obd-manager` library continuously listens for disconnection events provided by the underlying native Bluetooth system (via `react-native-ble-manager`).
2.  **State Update:** If the library detects that the currently connected device (`connectedDevice`) has disconnected unexpectedly, it automatically performs the necessary cleanup and updates its internal state.
3.  **`connectedDevice` Becomes `null`:** The most important outcome of this process is that the `connectedDevice` state variable (provided by the `useBluetooth` hook) will be set back to `null`.

**How Your Application Detects Disconnection:**

You don't need to subscribe to a specific "disconnection event" from the library hook. Instead, you **monitor the `connectedDevice` state variable:**

*   When you successfully connect, `connectedDevice` changes from `null` to a `Peripheral` object.
*   When the connection ends – either because you called `disconnect()` *or* due to an unexpected event – `connectedDevice` changes from a `Peripheral` object back to `null`.

**Recommended Approach: Using `useEffect`**

The standard React way to react to this state change is by using the `useEffect` hook, listing `connectedDevice` in its dependency array.

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useBluetooth } from 'react-native-bluetooth-obd-manager';

const ConnectionStatusWatcher = () => {
  const { connectedDevice } = useBluetooth();
  // Optional: Track previous connection state if needed for specific logic
  const [wasConnected, setWasConnected] = useState(!!connectedDevice);

  useEffect(() => {
    const isCurrentlyConnected = !!connectedDevice;

    // Check if the connection status changed
    if (isCurrentlyConnected !== wasConnected) {
      if (isCurrentlyConnected) {
        // Just connected (or reconnected)
        console.log(`Watcher: Connection established to ${connectedDevice?.name}`);
        // Perform actions needed on successful connection
      } else {
        // Just disconnected (manual or unexpected)
        console.log("Watcher: Connection lost.");
        Alert.alert("Connection Lost", "The connection to the OBD adapter was lost.");
        // Perform actions needed on disconnection:
        // - Stop any active polling loops (e.g., call your stopStreaming function)
        // - Clear displayed vehicle data
        // - Update UI to allow reconnection
        // stopMyPollingLoop(); // Example call
      }
      // Update tracker for the next change detection
      setWasConnected(isCurrentlyConnected);
    }
  }, [connectedDevice, wasConnected]); // Re-run effect when connectedDevice changes

  return (
    <View style={{ padding: 5, backgroundColor: '#f0f0f0', marginVertical: 5 }}>
      <Text style={{ textAlign: 'center', fontStyle: 'italic' }}>
        Connection Watcher Status: {connectedDevice ? `Connected to ${connectedDevice.name || connectedDevice.id}` : 'Disconnected'}
      </Text>
    </View>
  );
};

export default ConnectionStatusWatcher;
```

**Key Takeaway:** Monitor the `connectedDevice` state from the `useBluetooth` hook. When it transitions from an object to `null`, handle it as a disconnection event in your application logic (e.g., stop polling, update UI). The library ensures this state accurately reflects the real-time connection status, including unexpected drops.