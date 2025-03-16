import { ECUConnector, ELM_COMMANDS, RSP_ID } from '../utils/obdUtils';
import { formatPidCommand, convertPidValue } from '../utils/pidUtils';
import { logBluetoothError } from '../utils/errorUtils';

// Default timeouts 
const DEFAULT_TIMEOUT = 5000;
const INITIALIZATION_TIMEOUT = 10000;

// OBD Protocol IDs
export enum OBDProtocol {
  AUTO = 0,
  J1850PWM = 1,
  J1850VPW = 2,
  ISO9141 = 3,
  ISO14230_4KW = 4,
  ISO14230_4ST = 5,
  ISO15765_11_500 = 6,
  ISO15765_29_500 = 7,
  ISO15765_11_250 = 8,
  ISO15765_29_250 = 9,
  SAE_J1939 = 10
}

// Connection states
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  INITIALIZING = 'initializing',
  CONNECTED = 'connected',
  ERROR = 'error'
}

// Event types
export enum OBDEventType {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  PROTOCOL_DETECTED = 'protocol_detected',
  DATA_RECEIVED = 'data_received',
  ERROR = 'error'
}

// Event listener type
type OBDEventListener = (event: OBDEventType, data?: any) => void;

/**
 * OBD Manager Class
 * Handles high-level OBD communication and state management
 */
export class OBDManager {
  private static instance: OBDManager;
  private ecuConnector: ECUConnector | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private protocol: OBDProtocol = OBDProtocol.AUTO;
  private eventListeners: OBDEventListener[] = [];
  private autoReconnect: boolean = false;
  private streamingManager = StreamingStateManager.getInstance();
  
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): OBDManager {
    if (!OBDManager.instance) {
      OBDManager.instance = new OBDManager();
    }
    return OBDManager.instance;
  }
  
  /**
   * Set the ECU connector to use for communication
   * @param connector A raw or decoded ECU connector
   */
  public setECUConnector(connector: ECUConnector): void {
    this.ecuConnector = connector;
  }
  
  /**
   * Initialize OBD communication
   * Performs a standard initialization sequence
   */
  public async initialize(): Promise<boolean> {
    if (!this.ecuConnector) {
      throw new Error('ECU connector is not set');
    }
    
    try {
      this.setConnectionState(ConnectionState.INITIALIZING);
      
      // Reset the adapter
      await this.ecuConnector.sendCommand(ELM_COMMANDS.RESET);
      
      // Wait for reset to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Configure the adapter
      await this.ecuConnector.sendCommand(ELM_COMMANDS.ECHO_OFF);
      await this.ecuConnector.sendCommand(ELM_COMMANDS.LINEFEEDS_OFF);
      await this.ecuConnector.sendCommand(ELM_COMMANDS.HEADERS_OFF);
      await this.ecuConnector.sendCommand(ELM_COMMANDS.SPACES_OFF);
      
      // Set automatic protocol detection
      await this.ecuConnector.sendCommand(ELM_COMMANDS.AUTO_PROTOCOL);
      
      // Set adaptive timing
      await this.ecuConnector.sendCommand(ELM_COMMANDS.ADAPTIVE_TIMING_2);
      
      // Get current protocol
      const protocolResponse = await this.ecuConnector.sendCommand(ELM_COMMANDS.GET_PROTOCOL);
      this.detectProtocolFromResponse(protocolResponse);
      
      // If we have a protocol, we're connected
      if (this.protocol !== OBDProtocol.AUTO) {
        this.setConnectionState(ConnectionState.CONNECTED);
        this.notifyListeners(OBDEventType.CONNECTED);
        return true;
      } else {
        // Try to auto-detect protocol by requesting engine RPM
        const testResponse = await this.ecuConnector.sendCommand('010C');
        
        if (testResponse && !testResponse.includes('UNABLE TO CONNECT')) {
          // Get protocol again after successful communication
          const updatedProtocol = await this.ecuConnector.sendCommand(ELM_COMMANDS.GET_PROTOCOL);
          this.detectProtocolFromResponse(updatedProtocol);
          
          this.setConnectionState(ConnectionState.CONNECTED);
          this.notifyListeners(OBDEventType.CONNECTED);
          return true;
        } else {
          this.setConnectionState(ConnectionState.ERROR);
          return false;
        }
      }
    } catch (error) {
      logBluetoothError(error, 'OBDManager.initialize');
      this.setConnectionState(ConnectionState.ERROR);
      this.notifyListeners(OBDEventType.ERROR, error);
      return false;
    }
  }
  
  /**
   * Detect OBD protocol from response string
   * @param response Protocol response string
   */
  private detectProtocolFromResponse(response: string): void {
    if (!response) return;
    
    // Clean up the response
    const cleanResponse = response.trim().toUpperCase();
    
    // Extract protocol number (usually in format "A#" where # is the protocol number)
    const protocolRegex = /A(\d+)/;
    const match = cleanResponse.match(protocolRegex);
    
    if (match && match[1]) {
      const protocolNumber = parseInt(match[1], 10);
      if (protocolNumber >= 0 && protocolNumber <= 10) {
        this.protocol = protocolNumber as OBDProtocol;
        this.notifyListeners(OBDEventType.PROTOCOL_DETECTED, this.protocol);
      }
    }
  }
  
  /**
   * Get a readable name for the current protocol
   */
  public getProtocolName(): string {
    switch (this.protocol) {
      case OBDProtocol.AUTO: return 'Auto';
      case OBDProtocol.J1850PWM: return 'SAE J1850 PWM';
      case OBDProtocol.J1850VPW: return 'SAE J1850 VPW';
      case OBDProtocol.ISO9141: return 'ISO 9141-2';
      case OBDProtocol.ISO14230_4KW: return 'ISO 14230-4 (KWP2000 Fast)';
      case OBDProtocol.ISO14230_4ST: return 'ISO 14230-4 (KWP2000 Slow)';
      case OBDProtocol.ISO15765_11_500: return 'ISO 15765-4 (CAN 11bit 500K)';
      case OBDProtocol.ISO15765_29_500: return 'ISO 15765-4 (CAN 29bit 500K)';
      case OBDProtocol.ISO15765_11_250: return 'ISO 15765-4 (CAN 11bit 250K)';
      case OBDProtocol.ISO15765_29_250: return 'ISO 15765-4 (CAN 29bit 250K)';
      case OBDProtocol.SAE_J1939: return 'SAE J1939 (CAN 29bit 250K)';
      default: return 'Unknown';
    }
  }
  
  /**
   * Set the current connection state
   * @param state New connection state
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
  }
  
  /**
   * Get the current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  
  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }
  
  /**
   * Get current protocol
   */
  public getProtocol(): OBDProtocol {
    return this.protocol;
  }
  
  /**
   * Send a command with proper error handling and timeouts
   * @param command OBD command to send
   * @param timeout Timeout in milliseconds
   */
  public async sendCommand(command: string, timeout: number = DEFAULT_TIMEOUT): Promise<string> {
    if (!this.ecuConnector) {
      throw new Error('ECU connector is not set');
    }
    
    if (this.connectionState !== ConnectionState.CONNECTED) {
      throw new Error('Not connected to OBD device');
    }
    
    try {
      this.streamingManager.startStreaming();
      const response = await this.ecuConnector.sendCommand(command);
      this.streamingManager.stopStreaming();
      this.notifyListeners(OBDEventType.DATA_RECEIVED, { command, response });
      return response;
    } catch (error) {
      this.streamingManager.stopStreaming();
      logBluetoothError(error, `OBDManager.sendCommand(${command})`);
      this.notifyListeners(OBDEventType.ERROR, error);
      throw error;
    }
  }
  
  /**
   * Request a standard PID and parse the result
   * @param mode OBD mode (e.g., 1 for current data)
   * @param pid PID number (e.g., 12 for RPM)
   */
  public async requestPid(mode: number, pid: number): Promise<any> {
    const command = formatPidCommand(mode, pid);
    const response = await this.sendCommand(command);
    
    // Get the hex data portion of the response
    const hexData = response;
    
    // Convert using our PID conversion utility
    return convertPidValue(hexData, command);
  }
  
  /**
   * Add event listener
   * @param listener Callback function for events
   */
  public addEventListener(listener: OBDEventListener): void {
    this.eventListeners.push(listener);
  }
  
  /**
   * Remove event listener
   * @param listener Listener to remove
   */
  public removeEventListener(listener: OBDEventListener): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
  }
  
  /**
   * Notify all listeners of an event
   * @param event Event type
   * @param data Optional event data
   */
  private notifyListeners(event: OBDEventType, data?: any): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in OBD event listener:', error);
      }
    });
  }
  
  /**
   * Disconnect and clean up
   */
  public disconnect(): void {
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.notifyListeners(OBDEventType.DISCONNECTED);
  }
  
  /**
   * Set auto reconnect flag
   * @param enable Whether to enable auto reconnect
   */
  public setAutoReconnect(enable: boolean): void {
    this.autoReconnect = enable;
  }
}

export class StreamingStateManager {
  private static instance: StreamingStateManager;
  private timeoutId: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private isStreaming: boolean = false;
  private readonly MAX_STREAM_DURATION = 4000; // 4 seconds

  static getInstance(): StreamingStateManager {
    if (!StreamingStateManager.instance) {
      StreamingStateManager.instance = new StreamingStateManager();
    }
    return StreamingStateManager.instance;
  }

  startStreaming(): void {
    this.isStreaming = true;
    this.startTime = Date.now();
    this.setStreamTimeout();
  }

  stopStreaming(): void {
    this.isStreaming = false;
    this.clearStreamTimeout();
  }

  private setStreamTimeout(): void {
    this.clearStreamTimeout();
    this.timeoutId = setTimeout(() => {
      console.warn('Stream timeout - force stopping stream');
      this.stopStreaming();
    }, this.MAX_STREAM_DURATION);
  }

  private clearStreamTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  getStreamDuration(): number {
    return this.isStreaming ? Date.now() - this.startTime : 0;
  }
}

export default OBDManager.getInstance();
