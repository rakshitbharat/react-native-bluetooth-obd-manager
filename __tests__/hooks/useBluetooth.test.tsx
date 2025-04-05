import React, { type FC, type ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform, ActionSheetIOS } from 'react-native';

import { useBluetooth } from '../../src/hooks/useBluetooth';
import { BluetoothProvider } from '../../src/context/BluetoothProvider';

import BleManager from 'react-native-ble-manager';
import Permissions from 'react-native-permissions';
import type { PermissionStatus, RESULTS, Permission } from 'react-native-permissions';
import { emitBleManagerEvent } from '../../__mocks__/react-native-ble-manager';
import { KNOWN_ELM327_TARGETS, DEFAULT_COMMAND_TIMEOUT, ELM327_COMMAND_TERMINATOR, ELM327_PROMPT_BYTE } from '../../src/constants';
import type { Peripheral } from 'react-native-ble-manager';

// Mock Date.now for timestamp consistency
const MOCK_DATE_NOW = 1678886400000;
let dateNowSpy: jest.SpyInstance;
beforeAll(() => { dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => MOCK_DATE_NOW); });
afterAll(() => { dateNowSpy.mockRestore(); });

// --- Mock Setup ---
const mockBleManager = jest.mocked(BleManager);
const mockPermissions = jest.mocked(Permissions);
const mockRESULTS = Permissions.RESULTS as typeof RESULTS;

// Helper Component
const wrapper: FC<{ children: ReactNode }> = ({ children }) => (<BluetoothProvider>{children}</BluetoothProvider>);

// Helper to create mock peripherals
const createMockPeripheral = (id: string, name?: string, services?: any[], characteristics?: any[]): Peripheral => ({
    id, name: name ?? `Mock_${id}`, rssi: -60, advertising: {}, services, characteristics
});

// Helper to advance timers
jest.useFakeTimers();

describe('useBluetooth Hook', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset Platform to default (e.g., Android 12+)
        Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
        Object.defineProperty(Platform, 'Version', { get: () => 31, configurable: true });
        // Default permissions granted
        mockPermissions.check.mockResolvedValue(mockRESULTS.GRANTED);
        mockPermissions.request.mockResolvedValue(mockRESULTS.GRANTED);
        mockPermissions.checkMultiple.mockImplementation(async (perms: Permission[]) => {
            const statuses: Record<string, PermissionStatus> = {};
            perms.forEach(p => statuses[p] = mockRESULTS.GRANTED);
            return statuses;
        });
         mockPermissions.requestMultiple.mockImplementation(async (perms: Permission[]) => {
            const statuses: Record<string, PermissionStatus> = {};
            perms.forEach(p => statuses[p] = mockRESULTS.GRANTED);
            return statuses;
        });
        // Mock BleManager state check
        mockBleManager.checkState.mockImplementation(() => {
            emitBleManagerEvent('BleManagerDidUpdateState', { state: 'on' }); // Assume BT is on initially
        });
        mockBleManager.start.mockResolvedValue(undefined);
        mockBleManager.scan.mockResolvedValue(undefined);
        mockBleManager.connect.mockResolvedValue(undefined);
        mockBleManager.disconnect.mockResolvedValue(undefined);
        mockBleManager.enableBluetooth.mockResolvedValue(undefined);
        mockBleManager.startNotification.mockResolvedValue(undefined);
        mockBleManager.stopNotification.mockResolvedValue(undefined);
        mockBleManager.write.mockResolvedValue(undefined);
        mockBleManager.writeWithoutResponse.mockResolvedValue(undefined);
        // Default retrieveServices mock (can be overridden per test)
        mockBleManager.retrieveServices.mockImplementation(async (id) => createMockPeripheral(id));
    });

    afterEach(() => {
       jest.clearAllTimers(); // Clear timers after each test
    });

    it('should handle initialization and initial state', async () => {
        const { result } = renderHook(() => useBluetooth(), { wrapper });
        expect(result.current.isInitializing).toBe(true);
        await waitFor(() => expect(result.current.isInitializing).toBe(false));
        expect(result.current.isBluetoothOn).toBe(true); // Because checkState emitted 'on'
    });

    // --- Permissions ---
    describe('Permissions', () => {
        it('checkPermissions grants correctly', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.checkPermissions(); });
            expect(result.current.hasPermissions).toBe(true);
        });
        it('requestBluetoothPermissions grants correctly', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            let success = false;
            await act(async () => { success = await result.current.requestBluetoothPermissions(); });
            expect(success).toBe(true);
            expect(result.current.hasPermissions).toBe(true);
        });
         it('promptEnableBluetooth calls BleManager.enableBluetooth on Android', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            // Turn BT off first
            await act(async () => { emitBleManagerEvent('BleManagerDidUpdateState', { state: 'off' }); });
            expect(result.current.isBluetoothOn).toBe(false);
             await act(async () => { await result.current.promptEnableBluetooth(); });
            expect(mockBleManager.enableBluetooth).toHaveBeenCalledTimes(1);
         });
         it('promptEnableBluetooth does nothing on iOS', async () => {
             Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
             const { result } = renderHook(() => useBluetooth(), { wrapper });
             await act(async () => { emitBleManagerEvent('BleManagerDidUpdateState', { state: 'off' }); });
             await act(async () => { await result.current.promptEnableBluetooth(); });
             expect(mockBleManager.enableBluetooth).not.toHaveBeenCalled();
         });
    });

    // --- Scanning ---
    describe('Scanning', () => {
        it('scanDevices starts scanning and updates state', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.checkPermissions(); }); // Ensure permissions first
            await act(async () => { result.current.scanDevices(1000); }); // Don't await promise here, check state change
            expect(result.current.isScanning).toBe(true);
            expect(mockBleManager.scan).toHaveBeenCalledWith([], 1, false);
        });

        it('scanDevices adds discovered devices', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.checkPermissions(); });
            await act(async () => { result.current.scanDevices(1000); });
            const mockDevice = createMockPeripheral('DEV1', 'OBD_Device');
            act(() => { emitBleManagerEvent('BleManagerDiscoverPeripheral', mockDevice); });
            expect(result.current.discoveredDevices).toHaveLength(1);
            expect(result.current.discoveredDevices[0].id).toBe('DEV1');
            expect(result.current.discoveredDevices[0].isLikelyOBD).toBe(true); // Check heuristic flag
        });

        it('scanDevices stops scanning after timeout/event', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.checkPermissions(); });
            const scanPromise = act(async () => result.current.scanDevices(1000));
            expect(result.current.isScanning).toBe(true);
            // Simulate scan stopping
            act(() => { emitBleManagerEvent('BleManagerStopScan', undefined); });
            await act(async () => { await scanPromise; }); // Now await the resolution
            expect(result.current.isScanning).toBe(false);
        });

        it('scanDevices rejects if Bluetooth is off', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { emitBleManagerEvent('BleManagerDidUpdateState', { state: 'off' }); });
            await expect(result.current.scanDevices()).rejects.toThrow('Bluetooth is currently turned off.');
        });
    });

    // --- Connection ---
    describe('Connection', () => {
        const deviceId = 'ELM327-1';
        const mockConfig = KNOWN_ELM327_TARGETS[0]; // Standard SPP

        beforeEach(() => {
            // Setup retrieveServices mock for successful connection
            const services = [{ uuid: mockConfig.serviceUUID }];
            const characteristics = [{
                service: mockConfig.serviceUUID,
                characteristic: mockConfig.writeCharacteristicUUID,
                properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } // Match expected properties
            }, {
                service: mockConfig.serviceUUID,
                characteristic: mockConfig.notifyCharacteristicUUID, // Assuming same char for notify
                properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' }
            }];
            mockBleManager.retrieveServices.mockResolvedValue(
                 createMockPeripheral(deviceId, 'MyELM', services, characteristics)
            );
        });

        it('connectToDevice successfully connects and finds config', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.checkPermissions(); });
            await act(async () => { await result.current.connectToDevice(deviceId); });

            expect(result.current.isConnecting).toBe(false);
            expect(result.current.connectedDevice?.id).toBe(deviceId);
            expect(result.current.activeDeviceConfig?.serviceUUID).toBe(mockConfig.serviceUUID);
            expect(result.current.activeDeviceConfig?.writeType).toBe('WriteWithoutResponse');
            expect(mockBleManager.connect).toHaveBeenCalledWith(deviceId);
            expect(mockBleManager.retrieveServices).toHaveBeenCalledWith(deviceId);
            expect(mockBleManager.startNotification).toHaveBeenCalledWith(deviceId, mockConfig.serviceUUID, mockConfig.notifyCharacteristicUUID);
        });

        it('connectToDevice fails if no compatible service found', async () => {
            mockBleManager.retrieveServices.mockResolvedValueOnce(createMockPeripheral(deviceId, 'WrongDevice', [{ uuid: 'wrong-uuid' }], [])); // Mock incompatible device
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.checkPermissions(); });

            await expect(result.current.connectToDevice(deviceId)).rejects.toThrow('Incompatible OBD device');
            expect(result.current.isConnecting).toBe(false);
            expect(result.current.connectedDevice).toBeNull();
            expect(result.current.error).not.toBeNull();
            expect(mockBleManager.disconnect).toHaveBeenCalledWith(deviceId); // Ensure cleanup disconnect called
        });
    });

    // --- Disconnection ---
    describe('Disconnection', () => {
        const deviceId = 'ELM327-Disc';
        const mockConfig = KNOWN_ELM327_TARGETS[0]; // Standard SPP

        // Helper to simulate connected state
        async function setupConnectedState(result: any) {
            const services = [{ uuid: mockConfig.serviceUUID }];
            const characteristics = [{ service: mockConfig.serviceUUID, characteristic: mockConfig.writeCharacteristicUUID, properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }, { service: mockConfig.serviceUUID, characteristic: mockConfig.notifyCharacteristicUUID, properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }];
            mockBleManager.retrieveServices.mockResolvedValue(createMockPeripheral(deviceId, 'ConnectedDev', services, characteristics));
            await act(async () => { await result.current.checkPermissions(); });
            await act(async () => { await result.current.connectToDevice(deviceId); });
             expect(result.current.connectedDevice?.id).toBe(deviceId); // Verify connected before test
        }

        it('disconnect successfully stops notification and disconnects', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);

            await act(async () => { await result.current.disconnect(); });

            expect(mockBleManager.stopNotification).toHaveBeenCalledWith(deviceId, mockConfig.serviceUUID, mockConfig.notifyCharacteristicUUID);
            expect(mockBleManager.disconnect).toHaveBeenCalledWith(deviceId);
            // State update (connectedDevice=null) happens via listener event emission
            act(() => { emitBleManagerEvent('BleManagerDisconnectPeripheral', { peripheral: deviceId }); });
            expect(result.current.connectedDevice).toBeNull();
            expect(result.current.activeDeviceConfig).toBeNull();
            expect(result.current.isDisconnecting).toBe(false);
        });

        it('handles unexpected disconnect event', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);

            // Simulate unexpected disconnect
             act(() => { emitBleManagerEvent('BleManagerDisconnectPeripheral', { peripheral: deviceId, reason: 'TIMEOUT' }); });

             expect(result.current.connectedDevice).toBeNull();
             expect(result.current.activeDeviceConfig).toBeNull();
             expect(result.current.isStreaming).toBe(false); // Check streaming also stops
        });
    });

    // --- Commands ---
    describe('Commands', () => {
        const deviceId = 'ELM327-Cmd';
        const mockConfig = KNOWN_ELM327_TARGETS[0]; // Standard SPP (WriteWithoutResponse)
         // Helper to simulate connected state
        async function setupConnectedState(result: any, config = mockConfig) {
            const services = [{ uuid: config.serviceUUID }];
            const characteristics = [{ service: config.serviceUUID, characteristic: config.writeCharacteristicUUID, properties: config.writeType === 'Write' ? { Write: 'Write', Notify: 'Notify'} : { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }, { service: config.serviceUUID, characteristic: config.notifyCharacteristicUUID, properties: config.writeType === 'Write' ? { Write: 'Write', Notify: 'Notify'} : { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }];
            mockBleManager.retrieveServices.mockResolvedValue(createMockPeripheral(deviceId, 'CmdDev', services, characteristics));
            await act(async () => { await result.current.checkPermissions(); });
            await act(async () => { await result.current.connectToDevice(deviceId); });
             expect(result.current.connectedDevice?.id).toBe(deviceId); // Verify connected
             expect(result.current.activeDeviceConfig?.writeType).toBe(config.writeType);
        }

        it('sendCommand sends command and receives string response', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result); // Uses default WriteWithoutResponse config

            const command = 'ATZ';
            const expectedBytes = Array.from(new TextEncoder().encode(command + ELM327_COMMAND_TERMINATOR));
            const responseString = 'ELM327 v1.5';
            const responseBytes = Array.from(new TextEncoder().encode(responseString));
            responseBytes.push(ELM327_PROMPT_BYTE); // Add prompt byte '>'

            // Initiate command, but don't await yet
            let commandPromise: Promise<string> | null = null;
             act(() => {
                 commandPromise = result.current.sendCommand(command);
             });

            expect(result.current.isAwaitingResponse).toBe(true);
            expect(mockBleManager.writeWithoutResponse).toHaveBeenCalledWith(deviceId, mockConfig.serviceUUID, mockConfig.writeCharacteristicUUID, expectedBytes);

            // Simulate receiving data in chunks
            act(() => { emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: responseBytes.slice(0, 5) }); });
            act(() => { emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: responseBytes.slice(5) }); });

            // Now await the promise
            await expect(commandPromise).resolves.toBe(responseString);
            expect(result.current.isAwaitingResponse).toBe(false);
            expect(result.current.lastSuccessfulCommandTimestamp).toBe(MOCK_DATE_NOW);
        });

         it('sendCommand uses Write method if configured', async () => {
            const vlinkerConfig = KNOWN_ELM327_TARGETS.find(t => t.name === 'VLinker Pattern')!;
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result, vlinkerConfig); // Setup with VLinker (Write)

            const command = '010C'; // RPM
             const expectedBytes = Array.from(new TextEncoder().encode(command + ELM327_COMMAND_TERMINATOR));
             await act(async () => { result.current.sendCommand(command); }); // Initiate

            expect(mockBleManager.write).toHaveBeenCalledWith(deviceId, vlinkerConfig.serviceUUID, vlinkerConfig.writeCharacteristicUUID, expectedBytes);
            expect(mockBleManager.writeWithoutResponse).not.toHaveBeenCalled();
             // Test would continue by simulating response...
         });

        it('sendCommand times out if no response with ">"', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);

            const command = 'AT L0';
            let commandPromise: Promise<string> | null = null;
            act(() => { commandPromise = result.current.sendCommand(command, { timeout: 100 }); }); // Short timeout

            expect(result.current.isAwaitingResponse).toBe(true);

            // Advance timers past the timeout
            act(() => { jest.advanceTimersByTime(150); });

            await expect(commandPromise).rejects.toThrow(`Command "${command}" timed out`);
            expect(result.current.isAwaitingResponse).toBe(false);
            expect(result.current.error?.message).toContain('timed out');
        });

        it('sendCommandRaw sends command and receives byte response', async () => {
             const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);

            const command = 'ATDPN';
            const responseBytesRaw = [0x41, 0x36]; // A6 (Protocol 6)
            const responseBytesWithPrompt = [...responseBytesRaw, ELM327_PROMPT_BYTE]; // Add '>'

            let commandPromise: Promise<Uint8Array> | null = null;
             act(() => {
                 commandPromise = result.current.sendCommandRaw(command);
             });

            expect(result.current.isAwaitingResponse).toBe(true);

            act(() => { emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: responseBytesWithPrompt }); });

            await expect(commandPromise).resolves.toEqual(Uint8Array.from(responseBytesRaw));
            expect(result.current.isAwaitingResponse).toBe(false);
        });

         it('rejects command if disconnected during wait', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);
            const command = '0100';
            let commandPromise: Promise<string> | null = null;
            act(() => { commandPromise = result.current.sendCommand(command); });
            expect(result.current.isAwaitingResponse).toBe(true);

            // Simulate disconnect before response
            act(() => { emitBleManagerEvent('BleManagerDisconnectPeripheral', { peripheral: deviceId }); });

            await expect(commandPromise).rejects.toThrow('Device disconnected during command.');
            expect(result.current.isAwaitingResponse).toBe(false); // Should be reset by disconnect
         });
    });

    // --- Streaming ---
    describe('Streaming', () => {
        const deviceId = 'ELM327-Stream';
         // Helper to simulate connected state
        async function setupConnectedState(result: any) { /* ... reuse from Commands ... */ }

        it('setStreaming updates isStreaming state', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            // await setupConnectedState(result); // Connect first
            // Need to connect before starting streaming
             await act(async () => { await result.current.checkPermissions(); });
             const config = KNOWN_ELM327_TARGETS[0];
             const services = [{ uuid: config.serviceUUID }];
             const characteristics = [{ service: config.serviceUUID, characteristic: config.writeCharacteristicUUID, properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }, { service: config.serviceUUID, characteristic: config.notifyCharacteristicUUID, properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }];
             mockBleManager.retrieveServices.mockResolvedValue(createMockPeripheral(deviceId, 'StreamDev', services, characteristics));
             await act(async () => { await result.current.connectToDevice(deviceId); });


            expect(result.current.isStreaming).toBe(false);
            act(() => { result.current.setStreaming(true); });
            expect(result.current.isStreaming).toBe(true);
            expect(result.current.lastSuccessfulCommandTimestamp).toBe(MOCK_DATE_NOW); // Timestamp reset on start

            act(() => { result.current.setStreaming(false); });
            expect(result.current.isStreaming).toBe(false);
            expect(result.current.lastSuccessfulCommandTimestamp).toBe(null); // Cleared on stop
        });

         it('automatically stops streaming due to inactivity', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result); // Connect first

            // Start streaming
            act(() => { result.current.setStreaming(true); });
            expect(result.current.isStreaming).toBe(true);
            const initialTimestamp = result.current.lastSuccessfulCommandTimestamp;

            // Simulate time passing without successful commands
            act(() => { jest.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT + 1000); }); // Advance past inactivity timeout

            // Wait for the state update triggered by the interval timer
            await waitFor(() => expect(result.current.isStreaming).toBe(false));
            expect(result.current.lastSuccessfulCommandTimestamp).toBeNull();
            expect(result.current.error?.message).toContain('Streaming stopped due to inactivity');
         });

         it('inactivity timer resets on successful command', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);
            act(() => { result.current.setStreaming(true); });
             expect(result.current.isStreaming).toBe(true);

            // Simulate time passing almost to timeout
             act(() => { jest.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT - 500); });
             expect(result.current.isStreaming).toBe(true); // Still streaming

            // Simulate successful command completion
            const command = 'ATZ';
            const responseString = 'OK';
            const responseBytesWithPrompt = [...Array.from(new TextEncoder().encode(responseString)), ELM327_PROMPT_BYTE];
            let cmdPromise: Promise<string> | null = null;
            act(() => { cmdPromise = result.current.sendCommand(command); });
            act(() => { emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: responseBytesWithPrompt }); });
            await act(async () => { await cmdPromise; }); // Wait for command to resolve

             expect(result.current.isStreaming).toBe(true); // Should still be streaming
             expect(result.current.lastSuccessfulCommandTimestamp).toBe(MOCK_DATE_NOW); // Timestamp updated

             // Advance time again, but less than timeout from *now*
             act(() => { jest.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT - 500); });
             expect(result.current.isStreaming).toBe(true); // Should still be streaming
         });

         it('cleans up streaming state on unmount', async () => {
             const { result, unmount } = renderHook(() => useBluetooth(), { wrapper });
             await setupConnectedState(result);
             act(() => { result.current.setStreaming(true); });
             expect(result.current.isStreaming).toBe(true);
             
             unmount();
             
             // Re-render to check reset state
             const { result: newResult } = renderHook(() => useBluetooth(), { wrapper });
             expect(newResult.current.isStreaming).toBe(false);
             expect(newResult.current.lastSuccessfulCommandTimestamp).toBeNull();
         });
    });
});