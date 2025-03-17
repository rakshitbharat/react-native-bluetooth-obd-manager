import { OBDManager, OBDProtocol } from '../managers/OBDManager';
import { ELM_COMMANDS } from '../utils/obdUtils';

// Create mock types for testing
interface MockECUConnector {
  sendCommand: jest.Mock;
  reset: jest.Mock;
}

// Mock external modules
jest.mock('../utils/obdUtils', () => ({
  ELM_COMMANDS: {
    RESET: 'ATZ',
    ECHO_OFF: 'ATE0',
    LINEFEEDS_OFF: 'ATL0',
    HEADERS_OFF: 'ATH0',
    SPACES_OFF: 'ATS0',
    AUTO_PROTOCOL: 'ATSP0',
    ADAPTIVE_TIMING_2: 'ATAT2',
    GET_PROTOCOL: 'ATDPN',
    GET_VERSION: 'ATI',
  },
}));

jest.mock('../utils/pidUtils', () => ({
  formatPidCommand: jest.fn((mode, pid) => `0${mode}${pid.toString(16).padStart(2, '0')}`),
  convertPidValue: jest.fn((hexData, command) => {
    if (command.toUpperCase() === '010C') return 750; // RPM
    return null;
  }),
}));

describe('OBDManager', () => {
  let obdManager: OBDManager;
  let mockConnector: MockECUConnector;

  beforeEach(() => {
    // Reset mocks and state
    jest.clearAllMocks();

    // Create mock connector
    mockConnector = {
      sendCommand: jest.fn().mockImplementation(command => {
        if (command === ELM_COMMANDS.RESET) return Promise.resolve('ELM327 v1.5');
        if (command === ELM_COMMANDS.ECHO_OFF) return Promise.resolve('OK');
        if (command === ELM_COMMANDS.LINEFEEDS_OFF) return Promise.resolve('OK');
        if (command === ELM_COMMANDS.HEADERS_OFF) return Promise.resolve('OK');
        if (command === ELM_COMMANDS.SPACES_OFF) return Promise.resolve('OK');
        if (command === ELM_COMMANDS.AUTO_PROTOCOL) return Promise.resolve('OK');
        if (command === ELM_COMMANDS.ADAPTIVE_TIMING_2) return Promise.resolve('OK');
        if (command === ELM_COMMANDS.GET_PROTOCOL) return Promise.resolve('A7');
        if (command === '010C') return Promise.resolve('410C1AFC'); // RPM value
        return Promise.resolve('NO DATA');
      }),
      reset: jest.fn(),
    };

    // Get OBDManager instance
    obdManager = OBDManager.getInstance();
    obdManager.setECUConnector(mockConnector);
  });

  test('should be a singleton', () => {
    const instance1 = OBDManager.getInstance();
    const instance2 = OBDManager.getInstance();

    expect(instance1).toBe(instance2);
  });

  test('should initialize correctly', async () => {
    const result = await obdManager.initialize();

    // Check result
    expect(result).toBe(true);

    // Check if all expected commands were sent
    expect(mockConnector.sendCommand).toHaveBeenCalledWith(ELM_COMMANDS.RESET);
    expect(mockConnector.sendCommand).toHaveBeenCalledWith(ELM_COMMANDS.ECHO_OFF);
    expect(mockConnector.sendCommand).toHaveBeenCalledWith(ELM_COMMANDS.LINEFEEDS_OFF);
    expect(mockConnector.sendCommand).toHaveBeenCalledWith(ELM_COMMANDS.HEADERS_OFF);
    expect(mockConnector.sendCommand).toHaveBeenCalledWith(ELM_COMMANDS.SPACES_OFF);
    expect(mockConnector.sendCommand).toHaveBeenCalledWith(ELM_COMMANDS.AUTO_PROTOCOL);
    expect(mockConnector.sendCommand).toHaveBeenCalledWith(ELM_COMMANDS.ADAPTIVE_TIMING_2);
    expect(mockConnector.sendCommand).toHaveBeenCalledWith(ELM_COMMANDS.GET_PROTOCOL);

    // Check if connected
    expect(obdManager.isConnected()).toBe(true);

    // Check protocol detection
    expect(obdManager.getProtocol()).toBe(OBDProtocol.ISO15765_29_500);
  });

  test('should send command correctly', async () => {
    // Initialize first
    await obdManager.initialize();

    // Send a command
    const response = await obdManager.sendCommand('010C');

    // Check response
    expect(response).toBe('410C1AFC');
    expect(mockConnector.sendCommand).toHaveBeenCalledWith('010C');
  });

  test('should request PID correctly', async () => {
    // Initialize first
    await obdManager.initialize();

    // Mock the response for RPM request
    mockConnector.sendCommand.mockImplementationOnce(() => Promise.resolve('410C1AFC'));

    // Request RPM
    const rpm = await obdManager.requestPid(1, 12); // 010C (mode 1, PID 12)

    // Check result
    expect(rpm).toBe(750);
  });

  test('should handle disconnection', async () => {
    // Initialize first
    await obdManager.initialize();

    // Verify connected
    expect(obdManager.isConnected()).toBe(true);

    // Disconnect
    await obdManager.disconnect();

    // Verify disconnected
    expect(obdManager.isConnected()).toBe(false);
  });
});
