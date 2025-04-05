// __tests__/hooks/useBluetooth.test.tsx

import React, { type FC, type ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

// Import the hook and provider
import { useBluetooth } from '../../src/hooks/useBluetooth';
import { BluetoothProvider } from '../../src/context/BluetoothProvider';

// Import mocks AND ensure they are mocked before use
// (jest.setup.js should handle the actual jest.mock calls)
import BleManager from 'react-native-ble-manager';
import Permissions from 'react-native-permissions';
import type { PermissionStatus, RESULTS, Permission } from 'react-native-permissions'; // Import types from actual module for casting
import { emitBleManagerEvent } from '../../__mocks__/react-native-ble-manager'; // Import helper from mock
import { KNOWN_ELM327_TARGETS, DEFAULT_COMMAND_TIMEOUT, DEFAULT_STREAMING_INACTIVITY_TIMEOUT, ELM327_COMMAND_TERMINATOR, ELM327_PROMPT_BYTE } from '../../src/constants';
import type { Peripheral } from 'react-native-ble-manager';

// --- Mock Date.now for timestamp consistency ---
const MOCK_DATE_NOW = 1678886400000;
let dateNowSpy: jest.SpyInstance;
beforeAll(() => { dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => MOCK_DATE_NOW); });
afterAll(() => { dateNowSpy.mockRestore(); });

// --- Get Typed Mock Functions ---
// We get the references here, but configure implementations in beforeEach
const mockBleManager = jest.mocked(BleManager);
const mockPermissions = jest.mocked(Permissions);
const mockRESULTS = Permissions.RESULTS as typeof RESULTS; // Cast for type safety

// Helper Component: Wrapper with Provider
const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
  <BluetoothProvider>{children}</BluetoothProvider>
);

// Helper to create mock peripherals
const createMockPeripheral = (id: string, name?: string, services?: any[], characteristics?: any[]): Peripheral => ({
    id, name: name ?? `Mock_${id}`, rssi: -60, advertising: {}, services, characteristics
});

// Disable fake timers for now to debug hanging issue
// jest.useFakeTimers();

describe('useBluetooth Hook Integration Tests', () => {

    // --- Setup & Teardown ---
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset Platform to default (Android 12+)
        Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
        Object.defineProperty(Platform, 'Version', { get: () => 31, configurable: true });

        // --- Configure Mocks Explicitly Here ---

        // Permissions (Default granted)
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

        // BleManager (Reset implementations for all used methods)
        mockBleManager.start.mockResolvedValue(undefined);
        // **** Key Change: Re-apply implementation for checkState ****
        mockBleManager.checkState.mockImplementation(() => {
             // Use setImmediate or process.nextTick to simulate async event emission better
             setImmediate(() => emitBleManagerEvent('BleManagerDidUpdateState', { state: 'on' }));
        });
        mockBleManager.scan.mockResolvedValue(undefined);
        mockBleManager.connect.mockResolvedValue(undefined);
        mockBleManager.disconnect.mockResolvedValue(undefined);
        mockBleManager.enableBluetooth.mockResolvedValue(undefined);
        mockBleManager.retrieveServices.mockImplementation(async (id) => createMockPeripheral(id)); // Default empty
        mockBleManager.startNotification.mockResolvedValue(undefined);
        mockBleManager.stopNotification.mockResolvedValue(undefined);
        mockBleManager.write.mockResolvedValue(undefined);
        mockBleManager.writeWithoutResponse.mockResolvedValue(undefined);
    });

    // Clear timers if fake timers are re-enabled later
    // afterEach(() => {
    //    jest.clearAllTimers();
    // });

    // --- Initialization and Basic State ---
    it('should initialize correctly and reflect initial BT state', async () => {
        const { result } = renderHook(() => useBluetooth(), { wrapper });
        expect(result.current.isInitializing).toBe(true);
        // Wait for initialization AND the simulated state update from checkState mock
        await waitFor(() => {
            expect(result.current.isInitializing).toBe(false);
            expect(result.current.isBluetoothOn).toBe(true);
        });
        expect(result.current.hasPermissions).toBe(false); // Initial state
    });

    it('should update isBluetoothOn when BleManagerDidUpdateState event is emitted', async () => {
        const { result } = renderHook(() => useBluetooth(), { wrapper });
        // Wait for initial 'on' state from beforeEach mock
        await waitFor(() => expect(result.current.isBluetoothOn).toBe(true));

        await act(async () => { emitBleManagerEvent('BleManagerDidUpdateState', { state: 'off' }); });
        expect(result.current.isBluetoothOn).toBe(false);

        await act(async () => { emitBleManagerEvent('BleManagerDidUpdateState', { state: 'on' }); });
        expect(result.current.isBluetoothOn).toBe(true);
    });

    // --- Permissions ---
    describe('Permissions', () => {
        it('checkPermissions updates state and returns true if granted', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            let granted = false;
            await act(async () => { granted = await result.current.checkPermissions(); });
            expect(granted).toBe(true);
            expect(result.current.hasPermissions).toBe(true);
        });

        it('checkPermissions updates state and returns false if denied', async () => {
            mockPermissions.checkMultiple.mockResolvedValueOnce({ [Permissions.PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: mockRESULTS.DENIED } as any);
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            let granted = true;
            await act(async () => { granted = await result.current.checkPermissions(); });
            expect(granted).toBe(false);
            expect(result.current.hasPermissions).toBe(false);
        });

        it('requestBluetoothPermissions updates state and returns true if granted', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            let granted = false;
            await act(async () => { granted = await result.current.requestBluetoothPermissions(); });
            expect(granted).toBe(true);
            expect(result.current.hasPermissions).toBe(true);
            expect(mockPermissions.requestMultiple).toHaveBeenCalled();
        });

        it('requestBluetoothPermissions updates state and returns false if denied', async () => {
            mockPermissions.requestMultiple.mockResolvedValueOnce({ [Permissions.PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: mockRESULTS.DENIED } as any);
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            let granted = true;
            await act(async () => { granted = await result.current.requestBluetoothPermissions(); });
            expect(granted).toBe(false);
            expect(result.current.hasPermissions).toBe(false);
        });

        it('requestBluetoothPermissions handles blocked status', async () => {
            mockPermissions.requestMultiple.mockResolvedValueOnce({ [Permissions.PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: mockRESULTS.BLOCKED } as any);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(); // Silence expected error log
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            let granted = true;
            await act(async () => { granted = await result.current.requestBluetoothPermissions(); });
            expect(granted).toBe(false);
            expect(result.current.hasPermissions).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Permissions blocked'));
            consoleErrorSpy.mockRestore();
        });

         it('promptEnableBluetooth calls BleManager.enableBluetooth on Android', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { emitBleManagerEvent('BleManagerDidUpdateState', { state: 'off' }); }); // Turn off first
            await waitFor(() => expect(result.current.isBluetoothOn).toBe(false)); // Wait for state change
            await act(async () => { await result.current.promptEnableBluetooth(); });
            expect(mockBleManager.enableBluetooth).toHaveBeenCalledTimes(1);
         });

         it('promptEnableBluetooth throws if user denies on Android', async () => {
            mockBleManager.enableBluetooth.mockRejectedValueOnce(new Error('User cancelled'));
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { emitBleManagerEvent('BleManagerDidUpdateState', { state: 'off' }); });
            await waitFor(() => expect(result.current.isBluetoothOn).toBe(false));
            await expect(result.current.promptEnableBluetooth()).rejects.toThrow('Failed to enable Bluetooth: User cancelled');
         });

         it('promptEnableBluetooth does nothing on iOS', async () => {
             Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
             const { result } = renderHook(() => useBluetooth(), { wrapper });
             await act(async () => { emitBleManagerEvent('BleManagerDidUpdateState', { state: 'off' }); });
             await waitFor(() => expect(result.current.isBluetoothOn).toBe(false));
             await act(async () => { await result.current.promptEnableBluetooth(); });
             expect(mockBleManager.enableBluetooth).not.toHaveBeenCalled();
         });
    });

    // --- Scanning ---
    describe('Scanning', () => {
        beforeEach(async () => {
            // Ensure permissions are granted for scanning tests
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            // Need to render hook here to set initial state, but discard result
            await act(async () => { await result.current.checkPermissions(); });
        });

        it('scanDevices starts scanning, updates state, and resolves on stop', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });

            await act(async () => {
                const scanPromise = result.current.scanDevices(1000);
                // Check intermediate state immediately
                expect(result.current.isScanning).toBe(true);
                expect(mockBleManager.scan).toHaveBeenCalledWith([], 1, false);
                // Simulate stop event
                emitBleManagerEvent('BleManagerStopScan', undefined);
                await scanPromise; // Wait for resolution
            });

            expect(result.current.isScanning).toBe(false);
        });

        it('scanDevices resolves promise when BleManagerStopScan is emitted', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            let scanPromise: Promise<void> | null = null;
            act(() => { scanPromise = result.current.scanDevices(1000); });
            expect(result.current.isScanning).toBe(true);
            act(() => { emitBleManagerEvent('BleManagerStopScan', undefined); });
            await expect(scanPromise).resolves.toBeUndefined();
            expect(result.current.isScanning).toBe(false);
        });

        it('scanDevices adds discovered devices with heuristic', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => {
                const scanPromise = result.current.scanDevices(1000);
                const mockDevice1 = createMockPeripheral('DEV1', 'OBD_Device');
                const mockDevice2 = createMockPeripheral('DEV2', 'Some Other Device');
                const mockDevice3 = createMockPeripheral('DEV3', 'VLINKER');

                act(() => { emitBleManagerEvent('BleManagerDiscoverPeripheral', mockDevice1); });
                act(() => { emitBleManagerEvent('BleManagerDiscoverPeripheral', mockDevice2); });
                act(() => { emitBleManagerEvent('BleManagerDiscoverPeripheral', mockDevice3); });

                await waitFor(() => expect(result.current.discoveredDevices).toHaveLength(3));

                emitBleManagerEvent('BleManagerStopScan', undefined);
                await scanPromise;
            });
            expect(result.current.discoveredDevices.find(d=>d.id==='DEV1')?.isLikelyOBD).toBe(true);
            expect(result.current.discoveredDevices.find(d=>d.id==='DEV2')?.isLikelyOBD).toBe(false);
            expect(result.current.discoveredDevices.find(d=>d.id==='DEV3')?.isLikelyOBD).toBe(true);
        });

        it('scanDevices rejects if Bluetooth is off', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { emitBleManagerEvent('BleManagerDidUpdateState', { state: 'off' }); });
            await waitFor(() => expect(result.current.isBluetoothOn).toBe(false));
            await expect(result.current.scanDevices()).rejects.toThrow('Bluetooth is off.');
        });

        it('scanDevices rejects if permissions missing', async () => {
            mockPermissions.checkMultiple.mockResolvedValueOnce({ [Permissions.PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: mockRESULTS.DENIED } as any);
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.checkPermissions(); }); // Set hasPermissions to false
            expect(result.current.hasPermissions).toBe(false);
            await expect(result.current.scanDevices()).rejects.toThrow('Permissions missing.');
        });

        it('scanDevices rejects on BleManager.scan error', async () => {
            mockBleManager.scan.mockRejectedValueOnce(new Error('Scan failed internally'));
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            // Assume permissions ok from beforeEach
            await expect(result.current.scanDevices()).rejects.toThrow('Scan failed internally');
            expect(result.current.isScanning).toBe(false);
            expect(result.current.error).toBeInstanceOf(Error);
        });
    });

    // --- Connection ---
    describe('Connection', () => {
        const deviceId = 'ELM327-1';
        const stdConfig = KNOWN_ELM327_TARGETS[0];
        const vlinkerConfig = KNOWN_ELM327_TARGETS.find(t => t.name === 'VLinker Pattern')!;

        const setupMockDeviceServices = (id: string, config: typeof stdConfig | typeof vlinkerConfig) => {
             const services = [{ uuid: config.serviceUUID }]; const characteristics = [ { service: config.serviceUUID, characteristic: config.writeCharacteristicUUID, properties: config.writeType === 'Write' ? { Write: 'Write', Notify: 'Notify' } : { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }, { service: config.serviceUUID, characteristic: config.notifyCharacteristicUUID, properties: config.writeType === 'Write' ? { Write: 'Write', Notify: 'Notify' } : { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } } ]; mockBleManager.retrieveServices.mockResolvedValue( createMockPeripheral(id, 'Device', services, characteristics) );
        };

        beforeEach(async () => {
            // Ensure permissions are granted for connection tests
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.checkPermissions(); });
        });

        it('connectToDevice succeeds (WriteWithoutResponse)', async () => {
            setupMockDeviceServices(deviceId, stdConfig);
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.connectToDevice(deviceId); });
            expect(result.current.isConnecting).toBe(false); expect(result.current.connectedDevice?.id).toBe(deviceId); expect(result.current.activeDeviceConfig?.serviceUUID).toBe(stdConfig.serviceUUID); expect(result.current.activeDeviceConfig?.writeType).toBe('WriteWithoutResponse'); expect(mockBleManager.connect).toHaveBeenCalledWith(deviceId); expect(mockBleManager.retrieveServices).toHaveBeenCalledWith(deviceId); expect(mockBleManager.startNotification).toHaveBeenCalledWith(deviceId, stdConfig.serviceUUID, stdConfig.notifyCharacteristicUUID);
        });

        it('connectToDevice succeeds (Write)', async () => {
            setupMockDeviceServices(deviceId, vlinkerConfig);
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.connectToDevice(deviceId); });
            expect(result.current.activeDeviceConfig?.writeType).toBe('Write');
        });

        it('connectToDevice fails if no compatible service/char found', async () => {
            mockBleManager.retrieveServices.mockResolvedValueOnce(createMockPeripheral(deviceId, 'WrongDevice', [{ uuid: 'wrong-uuid' }], []));
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await expect(result.current.connectToDevice(deviceId)).rejects.toThrow('Incompatible OBD device');
            expect(result.current.isConnecting).toBe(false); expect(result.current.connectedDevice).toBeNull(); expect(mockBleManager.disconnect).toHaveBeenCalledWith(deviceId);
        });

        it('connectToDevice rejects if BleManager.connect fails', async () => {
             mockBleManager.connect.mockRejectedValueOnce(new Error('Connection timed out'));
             const { result } = renderHook(() => useBluetooth(), { wrapper });
             await expect(result.current.connectToDevice(deviceId)).rejects.toThrow('Connection timed out');
             expect(result.current.isConnecting).toBe(false); expect(mockBleManager.disconnect).not.toHaveBeenCalled();
        });

        it('connectToDevice rejects if retrieveServices fails', async () => {
             mockBleManager.retrieveServices.mockRejectedValueOnce(new Error('Failed to get services'));
             const { result } = renderHook(() => useBluetooth(), { wrapper });
             await expect(result.current.connectToDevice(deviceId)).rejects.toThrow('Failed to get services');
             expect(result.current.isConnecting).toBe(false); expect(mockBleManager.disconnect).toHaveBeenCalledWith(deviceId);
        });

         it('connectToDevice rejects if startNotification fails', async () => {
             setupMockDeviceServices(deviceId, stdConfig);
             mockBleManager.startNotification.mockRejectedValueOnce(new Error('Cannot start notify'));
             const { result } = renderHook(() => useBluetooth(), { wrapper });
             await expect(result.current.connectToDevice(deviceId)).rejects.toThrow('Cannot start notify');
             expect(result.current.isConnecting).toBe(false); expect(mockBleManager.disconnect).toHaveBeenCalledWith(deviceId);
         });

        it('connectToDevice rejects if already connecting', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            mockBleManager.connect.mockReturnValueOnce(new Promise(() => {})); // Pending promise
            act(() => { result.current.connectToDevice(deviceId); }); // Don't await
            expect(result.current.isConnecting).toBe(true);
            await expect(result.current.connectToDevice('anotherID')).rejects.toThrow('Connection already in progress');
        });

        it('connectToDevice rejects if connected to different device', async () => {
             setupMockDeviceServices('OTHER_DEV', stdConfig);
             const { result } = renderHook(() => useBluetooth(), { wrapper });
             await act(async () => { await result.current.connectToDevice('OTHER_DEV'); });
             expect(result.current.connectedDevice?.id).toBe('OTHER_DEV');
             await expect(result.current.connectToDevice(deviceId)).rejects.toThrow('Already connected to a different device');
        });

         it('connectToDevice returns existing device if already connected to same ID', async () => {
             setupMockDeviceServices(deviceId, stdConfig);
             const { result } = renderHook(() => useBluetooth(), { wrapper });
             await act(async () => { await result.current.connectToDevice(deviceId); });
             expect(result.current.connectedDevice?.id).toBe(deviceId);
             let returnedDevice: Peripheral | null = null;
             await act(async () => { returnedDevice = await result.current.connectToDevice(deviceId); }); // Call again
             expect(returnedDevice?.id).toBe(deviceId);
             expect(mockBleManager.connect).toHaveBeenCalledTimes(1); // Connect only called once
         });
    });

    // --- Disconnection ---
    describe('Disconnection', () => {
        const deviceId = 'ELM327-Disc';
        const config = KNOWN_ELM327_TARGETS[0];
        async function setupConnectedState(result: any) {
             const services = [{ uuid: config.serviceUUID }]; const characteristics = [{ service: config.serviceUUID, characteristic: config.writeCharacteristicUUID, properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }, { service: config.serviceUUID, characteristic: config.notifyCharacteristicUUID, properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }]; mockBleManager.retrieveServices.mockResolvedValue(createMockPeripheral(deviceId, 'ConnectedDev', services, characteristics)); await act(async () => { await result.current.checkPermissions(); await result.current.connectToDevice(deviceId); }); expect(result.current.connectedDevice?.id).toBe(deviceId);
        }

        it('disconnect successfully calls methods, resolves, and updates state via event', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);
            await act(async () => {
                const disconnectPromise = result.current.disconnect();
                expect(mockBleManager.stopNotification).toHaveBeenCalledWith(deviceId, config.serviceUUID, config.notifyCharacteristicUUID);
                expect(mockBleManager.disconnect).toHaveBeenCalledWith(deviceId);
                // Simulate event *before* awaiting promise from hook
                emitBleManagerEvent('BleManagerDisconnectPeripheral', { peripheral: deviceId });
                await disconnectPromise;
            });
            expect(result.current.isDisconnecting).toBe(false);
            // Check state potentially updated by event
             await waitFor(() => expect(result.current.connectedDevice).toBeNull());
            expect(result.current.activeDeviceConfig).toBeNull();
        });

        it('handles unexpected disconnect event correctly', async () => {
             const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);
             await act(async () => { emitBleManagerEvent('BleManagerDisconnectPeripheral', { peripheral: deviceId, reason: 'TIMEOUT' }); });
             await waitFor(() => expect(result.current.connectedDevice).toBeNull());
             expect(result.current.activeDeviceConfig).toBeNull();
             expect(result.current.isStreaming).toBe(false);
        });

        it('disconnect does nothing if not connected', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await act(async () => { await result.current.disconnect(); });
            expect(mockBleManager.stopNotification).not.toHaveBeenCalled();
            expect(mockBleManager.disconnect).not.toHaveBeenCalled();
            expect(result.current.isDisconnecting).toBe(false);
        });

        it('disconnect rejects on BleManager.disconnect error', async () => {
            mockBleManager.disconnect.mockRejectedValueOnce(new Error('Disconnect HW error'));
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);
            await expect(result.current.disconnect()).rejects.toThrow('Disconnect HW error');
            expect(result.current.isDisconnecting).toBe(false);
            expect(result.current.error).toBeInstanceOf(Error);
            expect(result.current.connectedDevice?.id).toBe(deviceId); // Still connected in state
        });
    });

    // --- Commands ---
    describe('Commands', () => {
        const deviceId = 'ELM327-Cmd';
        const stdConfig = KNOWN_ELM327_TARGETS[0];
        const vlinkerConfig = KNOWN_ELM327_TARGETS.find(t => t.name === 'VLinker Pattern')!;

        async function setupConnectedState(result: any, config = stdConfig) {
             const services = [{ uuid: config.serviceUUID }]; const characteristics = [ { service: config.serviceUUID, characteristic: config.writeCharacteristicUUID, properties: config.writeType === 'Write' ? { Write: 'Write', Notify: 'Notify'} : { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }, { service: config.serviceUUID, characteristic: config.notifyCharacteristicUUID, properties: config.writeType === 'Write' ? { Write: 'Write', Notify: 'Notify'} : { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } } ]; mockBleManager.retrieveServices.mockResolvedValue(createMockPeripheral(deviceId, 'CmdDev', services, characteristics)); await act(async () => { await result.current.checkPermissions(); await result.current.connectToDevice(deviceId); }); expect(result.current.connectedDevice?.id).toBe(deviceId); expect(result.current.activeDeviceConfig?.writeType).toBe(config.writeType);
        }

        it('sendCommand sends command and receives string response', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result, stdConfig);
            const command = 'ATZ'; const expectedBytes = Array.from(new TextEncoder().encode(command + ELM327_COMMAND_TERMINATOR)); const responseString = 'ELM327 v1.5'; const responseBytesWithPrompt = [...Array.from(new TextEncoder().encode(responseString)), ELM327_PROMPT_BYTE];
            let commandPromise: Promise<string> | null = null;
            await act(async () => {
                 commandPromise = result.current.sendCommand(command);
                 await new Promise(setImmediate); // Allow async mock calls if any
                 expect(result.current.isAwaitingResponse).toBe(true);
                 expect(mockBleManager.writeWithoutResponse).toHaveBeenCalledWith(deviceId, stdConfig.serviceUUID, stdConfig.writeCharacteristicUUID, expectedBytes);
                 emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: responseBytesWithPrompt });
            });
            await expect(commandPromise).resolves.toBe(responseString);
            expect(result.current.isAwaitingResponse).toBe(false); expect(result.current.lastSuccessfulCommandTimestamp).toBe(MOCK_DATE_NOW);
        });

        it('handles multi-chunk responses correctly', async () => {
             const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result, stdConfig);
            const command = '0100'; const responseString = '41 00 BE 1F B8 10'; const chunk1 = Array.from(new TextEncoder().encode('41 00 BE ')); const chunk2 = Array.from(new TextEncoder().encode('1F B8 10')); const prompt = [ELM327_PROMPT_BYTE];
            let commandPromise: Promise<string> | null = null;
            await act(async () => {
                commandPromise = result.current.sendCommand(command);
                await new Promise(setImmediate);
                expect(result.current.isAwaitingResponse).toBe(true);
                // Emit chunks - no need for nested act if events are sync for the test
                emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: chunk1 });
                emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: chunk2 });
                emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: prompt });
            });
             await expect(commandPromise).resolves.toBe(responseString);
             expect(result.current.isAwaitingResponse).toBe(false);
        });

        it('sendCommand uses Write method if configured', async () => {
             const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result, vlinkerConfig);
            const command = '010C'; const expectedBytes = Array.from(new TextEncoder().encode(command + ELM327_COMMAND_TERMINATOR));
            // Using act for the hook call and await for potential internal async before mock check
            await act(async () => {
                result.current.sendCommand(command).catch(()=>{/* Ignore */}); // Don't await result here
                await new Promise(setImmediate); // Ensure internal async ops complete
            });
            expect(mockBleManager.write).toHaveBeenCalledWith(deviceId, vlinkerConfig.serviceUUID, vlinkerConfig.writeCharacteristicUUID, expectedBytes);
            expect(mockBleManager.writeWithoutResponse).not.toHaveBeenCalled();
            // Cleanup: fake response
            await act(async () => { emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: [ELM327_PROMPT_BYTE] }); });
             await waitFor(() => expect(result.current.isAwaitingResponse).toBe(false)); // Wait for state reset
         });

        // --- Timeout Test needs Fake Timers ---
        // Re-enable fake timers just for this test if they cause issues elsewhere
        describe('with Fake Timers', () => {
             beforeAll(() => { jest.useFakeTimers(); });
             afterAll(() => { jest.useRealTimers(); }); // Switch back after
             beforeEach(() => { jest.clearAllTimers(); }); // Clear before each

             it('sendCommand times out correctly', async () => {
                 const { result } = renderHook(() => useBluetooth(), { wrapper });
                 await setupConnectedState(result, stdConfig);
                 const command = 'AT L0'; let commandPromise: Promise<string> | null = null;
                 await act(async () => {
                     commandPromise = result.current.sendCommand(command, { timeout: 100 });
                     expect(result.current.isAwaitingResponse).toBe(true);
                     // Advance timers *within act*
                     jest.advanceTimersByTime(150);
                 });
                 await expect(commandPromise).rejects.toThrow(`Command "${command}" timed out`);
                 expect(result.current.isAwaitingResponse).toBe(false); expect(result.current.error?.message).toContain('timed out');
             });
        }); // End fake timer scope

        it('sendCommand rejects on BleManager write error', async () => {
            mockBleManager.writeWithoutResponse.mockRejectedValueOnce(new Error('Write failed'));
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result, stdConfig);
            await expect(result.current.sendCommand('ATZ')).rejects.toThrow('Write failed');
            expect(result.current.isAwaitingResponse).toBe(false);
        });

        it('sendCommand rejects if not connected', async () => {
             const { result } = renderHook(() => useBluetooth(), { wrapper });
             await expect(result.current.sendCommand('ATZ')).rejects.toThrow('Not connected');
        });

        it('sendCommand rejects if another command is pending', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result, stdConfig);
            act(() => { result.current.sendCommand('ATZ').catch(() => {}); });
            await waitFor(() => expect(result.current.isAwaitingResponse).toBe(true));
            await expect(result.current.sendCommand('ATE0')).rejects.toThrow('Command in progress');
            // Cleanup
            await act(async () => { emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: [ELM327_PROMPT_BYTE] }); });
            await waitFor(() => expect(result.current.isAwaitingResponse).toBe(false));
        });

        it('sendCommandRaw sends command and receives byte response', async () => {
             const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result, stdConfig);
            const command = 'ATDPN'; const responseBytesRaw = [0x41, 0x36]; const responseBytesWithPrompt = [...responseBytesRaw, ELM327_PROMPT_BYTE];
            let commandPromise: Promise<Uint8Array> | null = null;
            await act(async () => {
                commandPromise = result.current.sendCommandRaw(command);
                await new Promise(setImmediate);
                emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: responseBytesWithPrompt });
            });
            await expect(commandPromise).resolves.toEqual(Uint8Array.from(responseBytesRaw));
            expect(result.current.isAwaitingResponse).toBe(false);
        });

        it('rejects command if disconnected during wait', async () => {
            const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result, stdConfig);
            const command = '0100'; let commandPromise: Promise<string> | null = null;
            await act(async () => {
                commandPromise = result.current.sendCommand(command);
                await new Promise(setImmediate);
                expect(result.current.isAwaitingResponse).toBe(true);
                emitBleManagerEvent('BleManagerDisconnectPeripheral', { peripheral: deviceId }); // Disconnect before response
            });
            await expect(commandPromise).rejects.toThrow('Device disconnected during command.');
            expect(result.current.isAwaitingResponse).toBe(false);
        });
    });

    // --- Streaming ---
    describe('Streaming', () => {
        const deviceId = 'ELM327-Stream';
        const config = KNOWN_ELM327_TARGETS[0];
        async function setupConnectedState(result: any) {
             const services = [{ uuid: config.serviceUUID }]; const characteristics = [{ service: config.serviceUUID, characteristic: config.writeCharacteristicUUID, properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }, { service: config.serviceUUID, characteristic: config.notifyCharacteristicUUID, properties: { WriteWithoutResponse: 'WriteWithoutResponse', Notify: 'Notify' } }]; mockBleManager.retrieveServices.mockResolvedValue(createMockPeripheral(deviceId, 'StreamDev', services, characteristics)); await act(async () => { await result.current.checkPermissions(); await result.current.connectToDevice(deviceId); }); expect(result.current.connectedDevice?.id).toBe(deviceId);
        }

        it('setStreaming updates state', async () => {
             const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);
             expect(result.current.isStreaming).toBe(false);
             act(() => { result.current.setStreaming(true); });
             expect(result.current.isStreaming).toBe(true); expect(result.current.lastSuccessfulCommandTimestamp).toBe(MOCK_DATE_NOW);
             act(() => { result.current.setStreaming(false); });
             expect(result.current.isStreaming).toBe(false); expect(result.current.lastSuccessfulCommandTimestamp).toBe(null);
        });

        it('setStreaming(true) prevents starting if not connected', async () => {
             const { result } = renderHook(() => useBluetooth(), { wrapper });
             const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
             act(() => { result.current.setStreaming(true); });
             expect(result.current.isStreaming).toBe(false);
             expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot start streaming'));
             consoleErrorSpy.mockRestore();
        });

        // --- Timeout Test needs Fake Timers ---
        describe('with Fake Timers', () => {
             beforeAll(() => { jest.useFakeTimers(); });
             afterAll(() => { jest.useRealTimers(); });
             beforeEach(() => { jest.clearAllTimers(); });

             it('automatically stops streaming due to inactivity', async () => {
                 const { result } = renderHook(() => useBluetooth(), { wrapper });
                 await setupConnectedState(result);
                 act(() => { result.current.setStreaming(true); });
                 expect(result.current.isStreaming).toBe(true);
                 // Advance timers within act
                 await act(async () => { jest.advanceTimersByTime(DEFAULT_STREAMING_INACTIVITY_TIMEOUT + 1100); });
                 await waitFor(() => expect(result.current.isStreaming).toBe(false)); // Wait for state update from timer
                 expect(result.current.lastSuccessfulCommandTimestamp).toBeNull();
                 expect(result.current.error?.message).toContain('Streaming stopped due to inactivity');
             });

             it('inactivity timer resets on successful command', async () => {
                 const { result } = renderHook(() => useBluetooth(), { wrapper });
                 await setupConnectedState(result);
                 act(() => { result.current.setStreaming(true); });
                 const firstTimestamp = result.current.lastSuccessfulCommandTimestamp;

                 await act(async () => { jest.advanceTimersByTime(DEFAULT_STREAMING_INACTIVITY_TIMEOUT - 500); });
                 expect(result.current.isStreaming).toBe(true);

                 // Simulate successful command
                 const command = 'ATZ'; const responseString = 'OK'; const responseBytesWithPrompt = [...Array.from(new TextEncoder().encode(responseString)), ELM327_PROMPT_BYTE];
                 await act(async () => {
                     const cmdPromise = result.current.sendCommand(command);
                     await new Promise(setImmediate);
                     emitBleManagerEvent('BleManagerDidUpdateValueForCharacteristic', { value: responseBytesWithPrompt });
                     await cmdPromise;
                 });

                 expect(result.current.isStreaming).toBe(true);
                 expect(result.current.lastSuccessfulCommandTimestamp).toBe(MOCK_DATE_NOW);
                 expect(result.current.lastSuccessfulCommandTimestamp).not.toBe(firstTimestamp);

                 // Advance time again, but less than timeout
                 await act(async () => { jest.advanceTimersByTime(DEFAULT_STREAMING_INACTIVITY_TIMEOUT - 500); });
                 expect(result.current.isStreaming).toBe(true); // Still streaming
             });
        }); // End fake timer scope


        it('streaming stops on disconnect', async () => {
             const { result } = renderHook(() => useBluetooth(), { wrapper });
            await setupConnectedState(result);
            act(() => { result.current.setStreaming(true); });
            expect(result.current.isStreaming).toBe(true);
            // Simulate disconnect
            await act(async () => { emitBleManagerEvent('BleManagerDisconnectPeripheral', { peripheral: deviceId }); });
            await waitFor(() => expect(result.current.connectedDevice).toBeNull());
            expect(result.current.isStreaming).toBe(false); // Reducer should handle this
        });
    });

}); // End main describe block