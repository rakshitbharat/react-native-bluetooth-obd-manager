/**
 * Represents a known Bluetooth Low Energy (BLE) Service and Characteristic
 * UUID combination commonly used by ELM327-compatible adapters for
 * Serial Port Profile (SPP) emulation.
 */
export interface Elm327SppTarget {
    /** Descriptive name for the adapter pattern */
    name: string;
    /** The UUID of the primary service */
    serviceUUID: string;
    /** The UUID for sending commands */
    writeCharacteristicUUID: string;
    /** The UUID for receiving responses */
    notifyCharacteristicUUID: string;
}
/**
 * List of known BLE Service/Characteristic combinations used by ELM327 clones.
 * The `connectToDevice` function iterates through this list to find a compatible
 * configuration on the target peripheral.
 */
export declare const KNOWN_ELM327_TARGETS: ReadonlyArray<Elm327SppTarget>;
/**
 * Default timeout in milliseconds for waiting for a command response (`>`).
 * Can be overridden per command via options in `sendCommand`.
 */
export declare const DEFAULT_COMMAND_TIMEOUT = 4000;
/**
 * Default timeout in milliseconds for the automatic streaming inactivity check.
 * When streaming, if no successful commands occur within this period, streaming will stop.
 */
export declare const DEFAULT_STREAMING_INACTIVITY_TIMEOUT = 4000;
/**
 * OBD-II command terminator character.
 */
export declare const ELM327_PROMPT = ">";
/**
 * OBD-II command terminator byte value (ASCII code for '>').
 */
export declare const ELM327_PROMPT_BYTE = 62;
/**
 * Carriage return character, required at the end of most ELM327 commands.
 */
export declare const ELM327_COMMAND_TERMINATOR = "\r";
//# sourceMappingURL=index.d.ts.map