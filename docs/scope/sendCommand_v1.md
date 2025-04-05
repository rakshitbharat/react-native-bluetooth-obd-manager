Okay, here is the refined Markdown section explicitly marking the need for raw byte array responses as a "TODO" or planned enhancement for the library.

---

## TODO / Planned Feature: Option for Raw Byte Array Response from Commands

**Current Behavior:**

The standard `sendCommand` function is designed for convenience when working with typical ELM327 text-based responses. Internally, it:
1.  Receives raw bytes from the Bluetooth device.
2.  Decodes these bytes into a string (likely assuming UTF-8/ASCII encoding).
3.  Waits for the string representation of the `>` terminator character.
4.  Returns the accumulated **response string** to the user.

**Limitation:**

This automatic byte-to-string conversion has limitations:
*   **Potential Data Loss:** If the device sends bytes that are not valid within the assumed encoding (e.g., raw binary data, characters from a different encoding), the conversion to a string can be lossy, replacing or misinterpreting the original bytes.
*   **Unreliable Round-Trip:** Consequently, attempting to convert the returned string *back* into bytes within your application code is **not guaranteed** to reproduce the exact original byte sequence sent by the device. This method is unreliable for handling anything other than simple, valid text.

**Need for Raw Bytes:**

Advanced users may require access to the **original, unmodified byte array** as received from the device *before* any string decoding occurs. Use cases include:
*   Processing responses containing non-ASCII or binary data.
*   Implementing highly specific, byte-level parsing algorithms.
*   Performing low-level communication debugging.

**Planned Enhancement (`TODO`):**

To address this need, a future enhancement is planned to provide users the option to receive the raw byte array directly. This will likely be implemented in one of the following ways:

1.  **Option in `sendCommand`:** Adding an optional parameter to the existing function.
    ```typescript
    // Proposed Syntax Example:
    const bytes: Uint8Array = await sendCommand('SOME_COMMAND', { returnType: 'bytes' });
    ```
2.  **New Dedicated Function:** Introducing a separate function specifically for raw byte handling.
    ```typescript
    // Proposed Syntax Example:
    const bytes: Uint8Array = await sendCommandRaw('SOME_COMMAND'); // Name hypothetical
    ```

**Implementation Note:** This requires modifying the library's internal command handling to buffer raw bytes, check for the byte value `0x3E` (the `>` character), and conditionally return either the standard decoded string or the raw `Uint8Array` buffer.

**When Available:** Users opting for the raw byte response will be responsible for all subsequent interpretation and decoding of the received `Uint8Array`.

**Status:** This functionality is **not yet implemented** but is recognized as a valuable addition for advanced use cases and is marked as a **TODO** for future development.