// jest.setup.js
import { jest } from '@jest/globals'; // Import ONLY jest for mocking API like jest.fn(), jest.mock()
import '@testing-library/jest-native/extend-expect';
require('@testing-library/jest-native/extend-expect');

/**
 * --- Mocking Core Dependencies ---
 */
jest.mock('react-native-ble-manager');
jest.mock('react-native-permissions');

/**
 * --- Mocking NativeEventEmitter ---
 */
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
    try {
        const { MockNativeEventEmitter } = require('./__mocks__/react-native-ble-manager');
        return MockNativeEventEmitter;
    } catch (error) {
        console.error("Error loading MockNativeEventEmitter from __mocks__/react-native-ble-manager:", error);
        return jest.fn().mockImplementation(() => ({ // Fallback basic mock
            addListener: jest.fn(() => ({ remove: jest.fn() })),
            removeListener: jest.fn(),
            removeAllListeners: jest.fn(),
        }));
    }
});

/**
 * --- Optional: Mock Platform ---
 */
// jest.mock('react-native/Libraries/Utilities/Platform', () => { /* ... */ });


/**
 * --- Optional: Silence Console Output During Tests ---
 */
// global.console = { /* ... */ };


/**
 * --- Global Test Setup ---
 */

beforeEach(() => {
    jest.clearAllMocks();
    // Reset specific mock implementations if needed
    /*
    const mockPermissions = require('react-native-permissions');
    // ... reset permission mocks ...
    const mockBleManager = require('react-native-ble-manager');
    // ... reset ble manager mocks ...
    */
});

// --- Other Global Hooks (Uncomment if needed) ---
// afterEach(() => { });
// beforeAll(() => { });
// afterAll(() => { });