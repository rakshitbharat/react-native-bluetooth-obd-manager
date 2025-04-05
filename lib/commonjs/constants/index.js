"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.KNOWN_ELM327_TARGETS = exports.ELM327_PROMPT_BYTE = exports.ELM327_PROMPT = exports.ELM327_COMMAND_TERMINATOR = exports.DEFAULT_STREAMING_INACTIVITY_TIMEOUT = exports.DEFAULT_COMMAND_TIMEOUT = void 0;
// src/constants/index.ts

/**
 * Represents a known Bluetooth Low Energy (BLE) Service and Characteristic
 * UUID combination commonly used by ELM327-compatible adapters for
 * Serial Port Profile (SPP) emulation.
 */

/**
 * List of known BLE Service/Characteristic combinations used by ELM327 clones.
 * The `connectToDevice` function iterates through this list to find a compatible
 * configuration on the target peripheral. UUIDs should be uppercase for consistent comparison.
 */
const KNOWN_ELM327_TARGETS = exports.KNOWN_ELM327_TARGETS = [{
  name: 'Standard SPP Emulation',
  // Common profile based on 0x1101
  serviceUUID: '00001101-0000-1000-8000-00805F9B34FB',
  writeCharacteristicUUID: '0000FFE1-0000-1000-8000-00805F9B34FB',
  // Often FFE1 for write/notify
  notifyCharacteristicUUID: '0000FFE1-0000-1000-8000-00805F9B34FB'
}, {
  name: 'Alternative SPP 1 (FFE0)',
  // Another common pattern found in clones
  serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB',
  writeCharacteristicUUID: '0000FFE1-0000-1000-8000-00805F9B34FB',
  notifyCharacteristicUUID: '0000FFE1-0000-1000-8000-00805F9B34FB'
}, {
  name: 'Alternative SPP 2 (FFF0)',
  // Yet another pattern
  serviceUUID: '0000FFF0-0000-1000-8000-00805F9B34FB',
  writeCharacteristicUUID: '0000FFF2-0000-1000-8000-00805F9B34FB',
  // Often FFF2 for Write
  notifyCharacteristicUUID: '0000FFF1-0000-1000-8000-00805F9B34FB' // Often FFF1 for Notify
}, {
  name: 'VLinker Pattern',
  // Pattern seen on VLinker devices (non-standard UUIDs)
  serviceUUID: 'E7810A71-73AE-499D-8C15-FAA9AEF0C3F2',
  writeCharacteristicUUID: 'BE781A71-73AE-499D-8C15-FAA9AEF0C3F2',
  // Supports WriteWithResponse
  notifyCharacteristicUUID: 'BE781A71-73AE-499D-8C15-FAA9AEF0C3F2'
}
// Add other known common patterns here if discovered
// Example: Some devices might use Nordic UART Service (NUS)
// {
//   name: 'Nordic UART Service (NUS)',
//   serviceUUID: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
//   writeCharacteristicUUID: '6E400002-B5A3-F393-E0A9-E50E24DCCA9E', // TX Characteristic (WriteWithoutResponse typically)
//   notifyCharacteristicUUID: '6E400003-B5A3-F393-E0A9-E50E24DCCA9E', // RX Characteristic (Notify)
// },
];

/**
 * Default timeout in milliseconds for waiting for a command response (`>`).
 * Can be overridden per command via options in `sendCommand`.
 */
const DEFAULT_COMMAND_TIMEOUT = exports.DEFAULT_COMMAND_TIMEOUT = 4000; // 4 seconds

/**
 * Default timeout in milliseconds for the automatic streaming inactivity check.
 * (TODO: Implement this logic)
 */
const DEFAULT_STREAMING_INACTIVITY_TIMEOUT = exports.DEFAULT_STREAMING_INACTIVITY_TIMEOUT = 4000; // 4 seconds

/**
 * OBD-II command terminator character.
 */
const ELM327_PROMPT = exports.ELM327_PROMPT = '>';
const ELM327_PROMPT_BYTE = exports.ELM327_PROMPT_BYTE = 0x3e; // ASCII code for '>'

/**
 * Carriage return character, required at the end of most ELM327 commands.
 */
const ELM327_COMMAND_TERMINATOR = exports.ELM327_COMMAND_TERMINATOR = '\r';
//# sourceMappingURL=index.js.map