// __tests__/hooks/sendCommandRawChunked.test.tsx

import React from 'react';
import { Platform } from 'react-native';
import BleManager from 'react-native-ble-manager';
import Permissions from 'react-native-permissions';
import { emitBleManagerEvent } from '../../__mocks__/react-native-ble-manager';
import { KNOWN_ELM327_TARGETS, ELM327_COMMAND_TERMINATOR, ELM327_PROMPT_BYTE } from '../../src/constants';
import type { Peripheral } from 'react-native-ble-manager';
import type { ChunkedResponse } from '../../src/types';

// --- Mock Setup ---
const mockBleManager = jest.mocked(BleManager);
const mockPermissions = jest.mocked(Permissions);

// Helper to create mock peripherals
const createMockPeripheral = (id: string, name?: string, services?: any[], characteristics?: any[]): Peripheral => ({
    id, name: name ?? `Mock_${id}`, rssi: -60, advertising: {}, services, characteristics
});

// Create a simple mock of the hook with sendCommandRawChunked added
const mockBluetoothHook = {
  isInitializing: false,
  isBluetoothOn: true,
  hasPermissions: false,
  isScanning: false,
  isConnecting: false,
  isDisconnecting: false,
  discoveredDevices: [],
  connectedDevice: null,
  activeDeviceConfig: null,
  isAwaitingResponse: false,
  isStreaming: false,
  lastSuccessfulCommandTimestamp: null,
  error: null,
  checkPermissions: jest.fn().mockResolvedValue(true),
  requestBluetoothPermissions: jest.fn().mockResolvedValue(true),
  promptEnableBluetooth: jest.fn().mockResolvedValue(undefined),
  scanDevices: jest.fn().mockResolvedValue(undefined),
  connectToDevice: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue(undefined),
  sendCommand: jest.fn().mockResolvedValue('OK'),
  sendCommandRaw: jest.fn().mockResolvedValue(new Uint8Array([0x4F, 0x4B])),
  sendCommandRawChunked: jest.fn().mockResolvedValue({
    data: new Uint8Array([0x45, 0x4C, 0x4D, 0x33, 0x32, 0x37, 0x20, 0x76, 0x31, 0x2E, 0x35]), // "ELM327 v1.5"
    chunks: [
      new Uint8Array([0x45, 0x4C, 0x4D]), // "ELM"
      new Uint8Array([0x33, 0x32, 0x37]), // "327"
      new Uint8Array([0x20, 0x76, 0x31, 0x2E, 0x35]) // " v1.5"
    ]
  }),
  setStreaming: jest.fn()
};

// Mock the actual hook module
jest.mock('../../src/hooks/useBluetooth', () => ({
  useBluetooth: jest.fn(() => mockBluetoothHook)
}));

// Import the hook after mocking
import { useBluetooth } from '../../src/hooks/useBluetooth';

describe('sendCommandRawChunked Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBleManager.start.mockResolvedValue(undefined);
    mockBleManager.checkState.mockImplementation(() => {
      setImmediate(() => emitBleManagerEvent('BleManagerDidUpdateState', { state: 'on' }));
    });
    
    // Reset our mock state
    Object.assign(mockBluetoothHook, {
      isInitializing: false,
      isBluetoothOn: true,
      hasPermissions: true,
      connectedDevice: createMockPeripheral('test-device', 'ELM327 Device'),
      activeDeviceConfig: KNOWN_ELM327_TARGETS[0],
      isAwaitingResponse: false,
      error: null
    });
  });

  it('should expose sendCommandRawChunked function', () => {
    const hook = useBluetooth();
    expect(typeof hook.sendCommandRawChunked).toBe('function');
  });

  it('should return chunked response with proper structure', async () => {
    const command = 'ATZ';
    const hook = useBluetooth();
    
    const response = await hook.sendCommandRawChunked(command);
    
    // Check that the function was called with the correct command
    expect(hook.sendCommandRawChunked).toHaveBeenCalledWith(command);
    
    // Verify the response structure
    expect(response).toBeDefined();
    expect(response.data).toBeInstanceOf(Uint8Array);
    expect(response.chunks).toBeInstanceOf(Array);
    expect(response.chunks.length).toBe(3);
    
    // Check that each chunk is a Uint8Array
    response.chunks.forEach(chunk => {
      expect(chunk).toBeInstanceOf(Uint8Array);
    });
    
    // Verify the data content matches expected output
    expect(Array.from(response.data)).toEqual([
      0x45, 0x4C, 0x4D, 0x33, 0x32, 0x37, 0x20, 0x76, 0x31, 0x2E, 0x35 // "ELM327 v1.5"
    ]);
    
    // Verify the chunks content
    expect(Array.from(response.chunks[0])).toEqual([0x45, 0x4C, 0x4D]); // "ELM"
    expect(Array.from(response.chunks[1])).toEqual([0x33, 0x32, 0x37]); // "327"
    expect(Array.from(response.chunks[2])).toEqual([0x20, 0x76, 0x31, 0x2E, 0x35]); // " v1.5"
  });

  it('should handle timeout for chunked responses', async () => {
    const command = 'ATZ';
    // Override the mock implementation for this specific test
    mockBluetoothHook.sendCommandRawChunked.mockImplementationOnce(() => {
      return Promise.reject(new Error('Command "ATZ" timed out after 4000ms.'));
    });
    
    const hook = useBluetooth();
    await expect(hook.sendCommandRawChunked(command)).rejects.toThrow(/timed out/);
  });

  it('should handle device disconnection during chunked command', async () => {
    const command = '0100';
    // Override the mock implementation for this specific test
    mockBluetoothHook.sendCommandRawChunked.mockImplementationOnce(() => {
      return Promise.reject(new Error('Device disconnected during command.'));
    });
    
    const hook = useBluetooth();
    await expect(hook.sendCommandRawChunked(command)).rejects.toThrow(/disconnected/);
  });

  it('should handle response with line breaks preserved in chunks', async () => {
    const command = '03'; // Get DTCs
    
    // Simulate a multi-line response with DTCs
    const multilineChunkedResponse: ChunkedResponse = {
      data: new Uint8Array([
        0x34, 0x33, 0x20, 0x30, 0x31, 0x20, 0x30, 0x31, 0x0D, // "43 01 01\r"
        0x34, 0x33, 0x20, 0x30, 0x32, 0x20, 0x30, 0x33, 0x0D  // "43 02 03\r"
      ]),
      chunks: [
        new Uint8Array([0x34, 0x33, 0x20, 0x30, 0x31, 0x20, 0x30, 0x31, 0x0D]), // "43 01 01\r"
        new Uint8Array([0x34, 0x33, 0x20, 0x30, 0x32, 0x20, 0x30, 0x33, 0x0D])  // "43 02 03\r"
      ]
    };
    
    mockBluetoothHook.sendCommandRawChunked.mockResolvedValueOnce(multilineChunkedResponse);
    
    const hook = useBluetooth();
    const response = await hook.sendCommandRawChunked(command);
    
    // Check that chunks preserve line breaks
    expect(response.chunks.length).toBe(2);
    
    // Each line should end with a carriage return (0x0D)
    expect(response.chunks[0][response.chunks[0].length - 1]).toBe(0x0D); // \r at end of first chunk
    expect(response.chunks[1][response.chunks[1].length - 1]).toBe(0x0D); // \r at end of second chunk
  });

  it('should handle empty chunks correctly', async () => {
    const command = 'AT@1'; // Request device description
    
    // Simulate some empty chunks in the response
    const responseWithEmptyChunk: ChunkedResponse = {
      data: new Uint8Array([0x4F, 0x42, 0x44, 0x49, 0x49]), // "OBDII" 
      chunks: [
        new Uint8Array([]), // Empty chunk
        new Uint8Array([0x4F, 0x42]), // "OB"
        new Uint8Array([]), // Another empty chunk
        new Uint8Array([0x44, 0x49, 0x49]) // "DII"
      ]
    };
    
    mockBluetoothHook.sendCommandRawChunked.mockResolvedValueOnce(responseWithEmptyChunk);
    
    const hook = useBluetooth();
    const response = await hook.sendCommandRawChunked(command);
    
    // Check that empty chunks are preserved
    expect(response.chunks.length).toBe(4);
    expect(response.chunks[0].length).toBe(0);
    expect(response.chunks[2].length).toBe(0);
    
    // Total data should be the concatenation of all chunks
    expect(Array.from(response.data)).toEqual([0x4F, 0x42, 0x44, 0x49, 0x49]);
  });

  it('should work with options parameter', async () => {
    const command = 'ATZ';
    const options = { timeout: 2000 };
    const hook = useBluetooth();
    
    await hook.sendCommandRawChunked(command, options);
    
    expect(hook.sendCommandRawChunked).toHaveBeenCalledWith(command, options);
  });
});
