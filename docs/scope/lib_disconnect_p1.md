Okay, here is the Markdown documentation for the `disconnect` function, formatted as a Usage Guide for end-users, along with an explanation similar to the `connectToDevice` breakdown.

---

## Markdown Documentation for Users (`Usage-Guide:-Disconnecting-from-a-Device.md`)

# Usage Guide: Disconnecting from a Device

When you are finished communicating with the OBD adapter, or when your app is closing, you should explicitly disconnect using the `disconnect` function provided by the `useBluetooth` hook.

## Why Disconnect?

*   **Battery Savings:** Maintaining the Bluetooth connection consumes power on both the phone and the OBD adapter.
*   **Adapter Availability:** Allows the adapter to be discovered and connected by other devices or applications if needed.
*   **Clean State:** Ensures the application and the Bluetooth stack return to a known, idle state regarding that specific device.
*   **Resource Release:** Frees up Bluetooth resources used by the connection on the phone.

## How to Disconnect

Call the `disconnect` function obtained from the `useBluetooth` hook. It's an asynchronous operation, but typically completes quickly. You should only call it if you are currently connected.

```typescript
import React, { useState } from 'react';
import { View, Button, Alert } from 'react-native';
import { useBluetooth } from 'react-native-bluetooth-obd-manager';

const DisconnectButton = () => {
  const { disconnect, connectedDevice } = useBluetooth();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    // Only attempt to disconnect if actually connected
    if (!connectedDevice) {
      console.log("Not currently connected, no need to disconnect.");
      // Optionally Alert.alert("Info", "Not connected to any device.");
      return;
    }

    setIsDisconnecting(true);
    console.log(`Disconnecting from ${connectedDevice.name || connectedDevice.id}...`);

    try {
      // Call the disconnect function from the hook
      await disconnect();

      console.log('Disconnected successfully.');
      Alert.alert('Disconnected', 'Successfully disconnected from the OBD adapter.');
      // The connectedDevice state provided by useBluetooth will now automatically update to null

    } catch (error: any) {
      // Errors during disconnect are less common but possible
      console.error('Disconnect error:', error);
      Alert.alert('Error', `Failed to disconnect: ${error.message}`);
    } finally {
      // Ensure the loading state is reset
      setIsDisconnecting(false);
    }
  };

  return (
    <View style={{ marginTop: 10 }}>
      <Button
        title={isDisconnecting ? 'Disconnecting...' : 'Disconnect OBD Adapter'}
        onPress={handleDisconnect}
        // Disable the button if not connected or already in the process of disconnecting
        disabled={!connectedDevice || isDisconnecting}
        color="red" // Use a distinct color for disconnect actions
      />
    </View>
  );
};

export default DisconnectButton;
