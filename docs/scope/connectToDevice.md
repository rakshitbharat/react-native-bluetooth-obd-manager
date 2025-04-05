## Internal Logic: Smart Service/Characteristic Discovery in `connectToDevice`

To connect reliably to a wide range of ELM327-compatible adapters, the `connectToDevice` function implements a strategy to search for known Bluetooth Low Energy (BLE) service and characteristic UUID combinations commonly used by these devices. It doesn't assume a single fixed set of UUIDs.

Below is **pseudocode** illustrating this internal approach:

```typescript
// --- PSEUDOCODE illustrating the internal connection strategy ---

// Define a list of known Service/Characteristic combinations used by ELM327 clones
const KNOWN_ELM327_TARGETS = [
  {
    name: "Standard SPP Emulation", // Common profile
    service: "00001101-0000-1000-8000-00805f9b34fb", // Standard Serial Port Service UUID
    writeChar: "0000ffe1-0000-1000-8000-00805f9b34fb", // Common Write Characteristic (often WriteWithoutResponse)
    notifyChar: "0000ffe1-0000-1000-8000-00805f9b34fb", // Often the same for Notify
  },
  {
    name: "Alternative SPP 1", // Another common pattern found in clones
    service: "0000ffe0-0000-1000-8000-00805f9b34fb",
    writeChar: "0000ffe1-0000-1000-8000-00805f9b34fb",
    notifyChar: "0000ffe1-0000-1000-8000-00805f9b34fb",
  },
  {
    name: "VLinker Pattern", // Pattern seen on VLinker devices
    service: "E7810A71-73AE-499D-8C15-FAA9AEF0C3F2",
    writeChar: "BE781A71-73AE-499D-8C15-FAA9AEF0C3F2", // Often supports WriteWithResponse
    notifyChar: "BE781A71-73AE-499D-8C15-FAA9AEF0C3F2",
  },
  // ... potentially add other known common patterns here
];

// Internal variable to store the found configuration
let activeDeviceConfig = null;

async function connectToDevice_InternalLogic(deviceId: string) {
  activeDeviceConfig = null; // Reset config on new connection attempt

  try {
    // 1. Connect to the peripheral
    console.log(`Connecting to ${deviceId}...`);
    await BleManager.connect(deviceId);
    console.log("Connected. Retrieving services...");

    // 2. Discover all services
    // Note: Retrieving services might implicitly discover characteristics in some BleManager versions/platforms
    const peripheralInfo = await BleManager.retrieveServices(deviceId);
    console.log("Services retrieved:", peripheralInfo.services);
    console.log("Characteristics (if pre-discovered):", peripheralInfo.characteristics);


    // 3. Iterate through known ELM327 targets to find a match
    for (const target of KNOWN_ELM327_TARGETS) {
      console.log(`Checking target: ${target.name} (Service: ${target.service})`);

      // Check if the target service UUID exists on the connected device
      const foundService = peripheralInfo.services?.find(s => s.uuid.toUpperCase() === target.service.toUpperCase());

      if (foundService) {
        console.log(`Found matching service: ${target.service}`);

        // Explicitly fetch characteristics for this service if not already fully retrieved
        // (May not be needed if retrieveServices already got them all)
        // let characteristics = peripheralInfo.characteristics?.filter(c => c.service.toUpperCase() === target.service.toUpperCase());
        // if (!characteristics || characteristics.length === 0) {
        //    characteristics = await BleManager.getCharacteristicsForService(deviceId, target.service);
        // }
        const characteristics = peripheralInfo.characteristics?.filter(c => c.service.toUpperCase() === target.service.toUpperCase());

        if (!characteristics || characteristics.length === 0) {
           console.warn(`Service ${target.service} found, but no characteristics listed/retrieved.`);
           continue; // Try next target
        }

        // Find the specific Write and Notify characteristics within this service
        const writeCharacteristic = characteristics.find(c => c.characteristic.toUpperCase() === target.writeChar.toUpperCase());
        const notifyCharacteristic = characteristics.find(c => c.characteristic.toUpperCase() === target.notifyChar.toUpperCase());

        if (writeCharacteristic && notifyCharacteristic) {
          console.log(`Found matching Write (${target.writeChar}) and Notify (${target.notifyChar}) characteristics!`);

          // 4. Determine Write Type (With or Without Response)
          let writeType = 'WriteWithoutResponse'; // Default assumption
          if (writeCharacteristic.properties.Write) {
            writeType = 'Write'; // Prefer WriteWithResponse if available
            console.log("Using Write (with response).");
          } else {
             console.log("Using Write Without Response.");
          }

          // 5. Enable Notifications
          console.log(`Starting notifications for ${target.notifyChar}...`);
          await BleManager.startNotification(deviceId, target.service, target.notifyChar);
          console.log("Notifications started.");

          // 6. Success! Store the configuration and break the loop
          activeDeviceConfig = {
            service: target.service,
            writeChar: target.writeChar,
            notifyChar: target.notifyChar,
            writeType: writeType,
          };
          console.log("Compatible configuration found:", activeDeviceConfig);
          break; // Exit the loop, we found our match
        } else {
           console.log(`Service ${target.service} found, but required characteristics not present.`);
        }
      } else {
        // console.log(`Service ${target.service} not found on device.`); // Can be verbose
      }
    } // End of loop through KNOWN_ELM327_TARGETS

    // 7. Check if a configuration was found
    if (activeDeviceConfig) {
      console.log("Connection successful and compatible configuration identified.");
      // Update global state (e.g., set `connectedDevice` in context)
      // Return peripheral info or resolve promise
      return peripheralInfo; // Or just resolve void
    } else {
      // Loop finished without finding any compatible configuration
      console.error("Connection failed: No compatible ELM327 service/characteristic configuration found after checking known patterns.");
      await BleManager.disconnect(deviceId); // Clean up connection
      throw new Error("Incompatible OBD device or required services/characteristics not found.");
    }

  } catch (error: any) {
    console.error("Connection process failed:", error);
    // Attempt to disconnect if an error occurred mid-process
    try { await BleManager.disconnect(deviceId); } catch (disconnectError) { /* Ignore */ }
    // Rethrow or handle the error appropriately
    throw error;
  }
}