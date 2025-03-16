import { ECUConnector } from '../connectors/ECUConnector';
import { useBluetooth } from '../context/BluetoothContext';
import { BluetoothErrorType, BluetoothOBDError } from '../utils/errorUtils';

// Mock the bluetooth context hook
jest.mock('../context/BluetoothContext', () => ({
  useBluetooth: jest.fn(),
}));

describe('ECUConnector', () => {
  let mockSendCommand: jest.Mock;
  let mockDisconnect: jest.Mock;
  let connector: ECUConnector;
  
  beforeEach(() => {
    // Setup mocks
    mockSendCommand = jest.fn();
    mockDisconnect = jest.fn();
    
    // Create a new connector instance for each test
    connector = new ECUConnector();
    
    // Initialize the connector with mock context and device ID
    connector.setContext({
      sendCommand: mockSendCommand,
      disconnect: mockDisconnect
    });
    connector.setDeviceId('test-device');
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendCommand', () => {
    it('should send command and return response', async () => {
      // Mock successful command
      mockSendCommand.mockResolvedValueOnce('41 0C 1A F8');
      
      const response = await connector.sendCommand('010C');
      
      expect(mockSendCommand).toHaveBeenCalledWith('010C', undefined);
      expect(response).toBe('41 0C 1A F8');
    });
    
    it('should handle command timeout', async () => {
      // Mock timeout error
      mockSendCommand.mockRejectedValueOnce(
        new BluetoothOBDError(BluetoothErrorType.TIMEOUT_ERROR, 'Command timed out')
      );
      
      await expect(connector.sendCommand('010C')).rejects.toThrow('Command timed out');
    });
    
    it('should pass timeout parameter', async () => {
      mockSendCommand.mockResolvedValueOnce('OK');
      
      await connector.sendCommand('ATZ', 5000);
      
      expect(mockSendCommand).toHaveBeenCalledWith('ATZ', 5000);
    });
    
    it('should handle connection errors', async () => {
      // Mock connection error
      mockSendCommand.mockRejectedValueOnce(
        new BluetoothOBDError(BluetoothErrorType.CONNECTION_ERROR, 'Device disconnected')
      );
      
      await expect(connector.sendCommand('010C')).rejects.toThrow('Device disconnected');
    });
  });
  
  describe('disconnect', () => {
    it('should call disconnect from context', async () => {
      mockDisconnect.mockResolvedValueOnce(true);
      
      await connector.disconnect();
      
      expect(mockDisconnect).toHaveBeenCalled();
    });
    
    it('should handle disconnect errors', async () => {
      mockDisconnect.mockRejectedValueOnce(new Error('Disconnect failed'));
      
      await expect(connector.disconnect()).rejects.toThrow('Disconnect failed');
    });
  });
  
  describe('reset', () => {
    it('should send ATZ command for reset', async () => {
      mockSendCommand.mockResolvedValueOnce('ELM327 v1.5');
      
      await connector.reset();
      
      expect(mockSendCommand).toHaveBeenCalledWith('ATZ', expect.any(Number));
    });
    
    it('should handle reset errors', async () => {
      mockSendCommand.mockRejectedValueOnce(new Error('Reset failed'));
      
      await expect(connector.reset()).rejects.toThrow('Reset failed');
    });
  });
  
  describe('isConnected', () => {
    it('should return true when device is connected', () => {
      (useBluetooth as jest.Mock).mockReturnValue({
        connectedDevice: { id: 'test-device' },
      });
      
      expect(connector.isConnected()).toBe(true);
    });
    
    it('should return false when no device is connected', () => {
      (useBluetooth as jest.Mock).mockReturnValue({
        connectedDevice: null,
      });
      
      // Create a new connector without a device ID
      const newConnector = new ECUConnector();
      newConnector.setContext({
        sendCommand: mockSendCommand,
        disconnect: mockDisconnect
      });
      // Don't set a device ID
      
      expect(newConnector.isConnected()).toBe(false);
    });

    it('should return false when device ID is null', () => {
      const connector = new ECUConnector();
      connector.setContext({
        sendCommand: mockSendCommand,
        disconnect: mockDisconnect
      });
      connector.setDeviceId(null); // Explicitly set deviceId to null
      
      expect(connector.isConnected()).toBe(false);
    });
  });
});
