TODO: Okay, let's integrate the `isStreaming` flag and a `setStreaming` function directly into the library's hook, making it "out-of-the-box" for the user, including the automatic 4-second inactivity timeout managed by the library itself.

This requires a change to the library's internal logic and state management.

## 1. Markdown Documentation for Users

This describes how users would interact with the new `isStreaming` state and `setStreaming` function provided by the `useBluetooth` hook.

# Tracking Active Data Fetching: `isStreaming` State

The `useBluetooth` hook now provides tools to help manage and track periods of continuous data fetching (polling), often referred to as "streaming".

**New Additions to `useBluetooth`:**

*   **`isStreaming: boolean` (Read-only State):**
    *   Indicates the library's understanding of whether an active data fetching process is (or should be) running.
    *   This flag is controlled both manually by you using `setStreaming` and **automatically by the library's inactivity timeout**.
*   **`setStreaming(shouldStream: boolean): void` (Function):**
    *   A function you call to explicitly tell the library that you are starting (`true`) or stopping (`false`) your continuous data fetching loop.

**How it Works:**

1.  **Starting Your Polling Loop:**
    *   When you begin your `setInterval` or similar mechanism to repeatedly call `sendCommand`, you **must** call `setStreaming(true)`. This informs the library that active communication is intended.
    ```typescript
    const startMyPollingLoop = () => {
      if (intervalRef.current) return; // Prevent multiple loops
      console.log("Starting data polling...");
      setIsMyAppPolling(true); // Optional: Your component's own state if needed

      // *** Tell the library streaming has started ***
      setStreaming(true);

      intervalRef.current = setInterval(fetchDataPeriodically, 1000);
      fetchDataPeriodically(); // Fetch once immediately
    };
    ```

2.  **Library Monitors Activity:**
    *   While `isStreaming` is `true`, the library internally monitors the success of your `sendCommand` calls. Each time a `sendCommand` call completes successfully (receives the `>` response before its own timeout), the library notes the time.

3.  **Automatic Inactivity Timeout:**
    *   If `isStreaming` is `true` and the library detects that **no `sendCommand` call has completed successfully for approximately 4 seconds**, it will **automatically set its internal `isStreaming` state back to `false`**.
    *   This acts as a safety net, assuming that if no data could be fetched for that duration, the "stream" is effectively broken or inactive.
    *   Your component will re-render, and the `isStreaming` value you get from the hook will now be `false`. You should use this state change to potentially stop your `setInterval` loop and update your UI.

4.  **Stopping Your Polling Loop:**
    *   When you manually stop your `setInterval` loop (e.g., user presses a "Stop" button, the component unmounts, or a critical unrecoverable error occurs in your loop), you **must** call `setStreaming(false)`. This immediately updates the library's state and stops its internal inactivity monitoring.
    ```typescript
    const stopMyPollingLoop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      console.log("Stopping data polling...");
      setIsMyAppPolling(false); // Optional: Your component's own state

      // *** Tell the library streaming has stopped ***
      setStreaming(false);
    };
    ```

**Using the `isStreaming` State:**

You can read the `isStreaming` state from the hook to control your UI or logic:

*   Disable a "Start Streaming" button if `isStreaming` is `true`.
*   Enable a "Stop Streaming" button only if `isStreaming` is `true`.
*   Display a status indicator ("Streaming Active" / "Streaming Inactive").
*   **Important:** Use `useEffect` to react to changes in the library's `isStreaming` state, especially the automatic change from `true` to `false` due to inactivity. When it becomes `false` automatically, you should ensure your own `setInterval` loop is also stopped.

**Example Component reacting to `isStreaming`:**

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { useBluetooth } from 'react-native-bluetooth-obd-manager';

const StreamingComponent = () => {
  const {
    connectedDevice,
    sendCommand,
    isStreaming,      // <-- Get state from hook
    setStreaming,     // <-- Get function from hook
  } = useBluetooth();

  const [rpm, setRpm] = useState(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch data (called by interval)
  const fetchDataPeriodically = async () => {
    if (!connectedDevice || !isStreaming) { // Also check isStreaming state from library
      stopMyPollingLoop(); // Stop if disconnected or library turned off streaming
      return;
    }
    try {
      console.log("Polling: Fetching RPM...");
      const rpmResponse = await sendCommand('010C'); // Library tracks success internally
      // ... parse response ...
      setRpm(parsedRpm);
    } catch (error) {
      console.error("Polling fetch error:", error);
      // Library's automatic timeout will handle stopping isStreaming if this persists
      // You might add your own logic for immediate stop on certain errors
    }
  };

  // Function to START polling
  const startMyPollingLoop = () => {
    if (intervalRef.current || !connectedDevice) return;
    console.log("Starting data polling...");
    setStreaming(true); // Tell library polling is starting
    intervalRef.current = setInterval(fetchDataPeriodically, 1000); // Start your interval
    fetchDataPeriodically();
  };

  // Function to STOP polling
  const stopMyPollingLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log("Stopped data polling manually.");
      // Only call setStreaming(false) if WE are stopping it manually
      // Avoid calling it if the library already set it to false due to timeout
      if (isStreaming) {
         setStreaming(false); // Tell library polling is stopping
      }
    }
  };

  // Effect to react to LIBRARY's isStreaming flag changes (especially auto-timeout)
  useEffect(() => {
    if (!isStreaming && intervalRef.current) {
      // If the library's flag turned false (e.g., timeout) but our interval is still running...
      console.log("Library streaming flag turned false (timeout?), stopping interval.");
      clearInterval(intervalRef.current); // Stop our loop
      intervalRef.current = null;
    }
  }, [isStreaming]); // Re-run when library's isStreaming state changes

  // Effect for cleanup on unmount
  useEffect(() => {
    return () => {
      stopMyPollingLoop(); // Ensure loop stops and library is notified on unmount
    };
  }, []);

  return (
    <View>
      <Text>Status: {connectedDevice ? 'Connected' : 'Disconnected'}</Text>
      <Text>Streaming Status (Library): {isStreaming ? 'Active' : 'Inactive'}</Text>
      {isStreaming && <ActivityIndicator />}
      <Text>RPM: {rpm ?? '--'}</Text>
      <Button title="Start Streaming" onPress={startMyPollingLoop} disabled={isStreaming || !connectedDevice} />
      <Button title="Stop Streaming" onPress={stopMyPollingLoop} disabled={!isStreaming} />
    </View>
  );
};
```

By using `setStreaming` to signal your intent and observing the `isStreaming` state (which includes the automatic inactivity timeout), you can more easily manage continuous data fetching operations. Remember to synchronize your application's polling loop (`setInterval`) with the library's `isStreaming` state.

```

## 2. Explanation of Library Logic (Internal View)

To provide the `isStreaming` state and `setStreaming` function with the automatic 4-second inactivity timeout, the library's internal logic needs modifications:

1.  **New State Variables:** The `BluetoothContext` state needs two additions:
    *   `isStreaming: boolean` (defaults to `false`)
    *   `lastSuccessfulCommandTimestamp: number | null` (defaults to `null`)

2.  **New Action & Reducer Case for `setStreaming`:**
    *   A new action type (e.g., `SET_STREAMING_STATUS`) is needed.
    *   The `setStreaming(shouldStream)` function provided by the hook dispatches this action with the `shouldStream` boolean payload.
    *   The reducer handles this action:
        *   Updates `state.isStreaming = shouldStream`.
        *   If `shouldStream` is `true`, it should potentially reset `lastSuccessfulCommandTimestamp = Date.now()` (to give it a grace period) and **start** the internal inactivity monitor timer.
        *   If `shouldStream` is `false`, it should **clear/stop** the internal inactivity monitor timer.

3.  **Modify `sendCommand` Logic:**
    *   When a `sendCommand` call completes **successfully** (receives `>` before its *own* command timeout), the internal logic *must* update the state:
        *   `lastSuccessfulCommandTimestamp = Date.now();`
    *   This timestamp update is the key input for the inactivity monitor.

4.  **Implement Inactivity Monitor:**
    *   This requires an internal timer mechanism (e.g., `setInterval`) managed by the `BluetoothContext` or a related effect.
    *   This timer **only runs when `state.isStreaming` is `true`**.
    *   It checks periodically (e.g., every 1 second).
    *   The check logic:
        ```typescript
        if (state.isStreaming && state.lastSuccessfulCommandTimestamp) {
          const timeSinceLastSuccess = Date.now() - state.lastSuccessfulCommandTimestamp;
          if (timeSinceLastSuccess > 4000) { // 4-second inactivity threshold
            // Inactivity detected! Dispatch action to stop streaming state.
            dispatch({ type: 'STREAMING_INACTIVITY_TIMEOUT' });
          }
        }
        