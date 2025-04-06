import type { UseBluetoothResult } from '../types';
/**
 * Custom hook for managing Bluetooth connections with ELM327 OBD-II adapters.
 *
 * Provides a complete interface for:
 * - Checking and requesting Bluetooth permissions
 * - Scanning for nearby Bluetooth devices
 * - Connecting to ELM327-compatible OBD-II adapters
 * - Sending commands and receiving responses
 * - Managing connection state
 *
 * @returns {UseBluetoothResult} Object containing Bluetooth state and control functions
 * @example
 * ```tsx
 * const {
 *   isBluetoothOn,
 *   discoveredDevices,
 *   connectedDevice,
 *   scanDevices,
 *   connectToDevice,
 *   sendCommand,
 * } = useBluetooth();
 *
 * // Check if Bluetooth is enabled
 * if (!isBluetoothOn) {
 *   // Show a message or prompt the user to enable Bluetooth
 * }
 *
 * // Start scanning for devices
 * const handleScan = async () => {
 *   try {
 *     await scanDevices(5000); // Scan for 5 seconds
 *     // Devices will be in discoveredDevices array
 *   } catch (error) {
 *     console.error('Scan failed:', error);
 *   }
 * };
 * ```
 */
export declare const useBluetooth: () => UseBluetoothResult;
//# sourceMappingURL=useBluetooth.d.ts.map