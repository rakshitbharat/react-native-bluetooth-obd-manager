// jest.setup.js
import { jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals'; // Import ONLY 'jest' for mocking API like jest.fn(), jest.mock()

/**
 * --- Mocking Core Dependencies ---
 * Jest automatically intercepts imports for these modules and uses the
 * implementations found in the `__mocks__` directory.
 * We explicitly call jest.mock() here to make it clear these are mocked
 * and potentially to configure advanced mocking options if needed later.
 */
jest.mock('react-native-ble-manager', () => {
    return {
        start: jest.fn(() => Promise.resolve()),
        scan: jest.fn(),
        stopScan: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
        retrieveServices: jest.fn(),
        write: jest.fn(() => Promise.resolve()),
        read: jest.fn(() => Promise.resolve('OK\r')), // Mock successful responses
    };
});
jest.mock('react-native-permissions');

/**
 * --- Mocking NativeEventEmitter ---
 * NativeEventEmitter is often used internally by libraries like react-native-ble-manager.
 * We need to mock its constructor and methods. We point it to the mock implementation
 * defined within our react-native-ble-manager mock.
 * Make sure the path './__mocks__/react-native-ble-manager' is correct relative to the project root.
 */
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
    return jest.fn().mockImplementation(() => ({
        addListener: jest.fn(() => ({ remove: jest.fn() })),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
    }));
});

/**
 * --- Optional: Mock Platform ---
 * Useful if you have platform-specific logic you want to test consistently.
 * Uncomment and adjust OS/Version as needed for specific test suites if required.
 */
// jest.mock('react-native/Libraries/Utilities/Platform', () => {
//   const Platform = jest.requireActual('react-native/Libraries/Utilities/Platform'); // Get actual Platform
//   return {
//     ...Platform, // Keep original properties
//     OS: 'android', // Default mock OS for tests (can be 'ios')
//     Version: 31, // Default mock Version
//     select: jest.fn(selector => selector[Platform.OS]), // Mock select based on mocked OS
//   };
// });


/**
 * --- Optional: Silence Console Output During Tests ---
 * Uncomment sections to hide specific console methods during test runs,
 * making the output cleaner. Be cautious silencing console.error.
 */
// global.console = {
//   ...console, // Keep original console methods
//   // log: jest.fn(), // Mock console.log
//   info: jest.fn(), // Mock console.info
//   warn: jest.fn(), // Mock console.warn
//   // error: jest.fn(), // Mock console.error - use with caution!
// };


/**
 * --- Global Test Setup ---
 * Functions like beforeEach, afterEach, beforeAll, afterAll run automatically
 * by Jest for setup and teardown between tests and test suites.
 */

// Runs before each individual test case (it block)
beforeEach(() => {
    // Reset all mocks provided by jest.fn(), jest.spyOn etc. before each test.
    // This ensures tests are isolated and don't interfere with each other's mock usage.
    jest.clearAllMocks();
    jest.clearAllTimers();

    // You can also reset specific mock implementations to their default
    // behavior here if your tests modify them. Example:
    /*
    const mockPermissions = require('react-native-permissions');
    const mockRESULTS = mockPermissions.RESULTS;
    // Reset checkMultiple to default GRANTED implementation
    jest.mocked(mockPermissions.checkMultiple).mockImplementation(async (perms) => {
        const statuses = {};
        perms.forEach(p => statuses[p] = mockRESULTS.GRANTED);
        return statuses;
    });
    // Reset BleManager.start to resolve successfully
    const mockBleManager = require('react-native-ble-manager');
    jest.mocked(mockBleManager.start).mockResolvedValue(undefined);
    */
});

// --- Other Global Hooks (Uncomment if needed) ---

// Runs after each individual test case
// afterEach(() => {
//   // console.log('Test Finished');
// });

// Runs once before any tests in the suite start
// beforeAll(() => {
//   // console.log('Starting Test Suite');
// });

// Runs once after all tests in the suite have finished
// afterAll(() => {
//   // console.log('Finished Test Suite');
// });