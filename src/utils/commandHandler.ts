import { Observable, firstValueFrom, Subject, timer } from 'rxjs';
import { filter, take, timeout } from 'rxjs/operators';

import { isResponseComplete } from './dataUtils';
import { BluetoothErrorType, BluetoothOBDError } from './errorUtils';
import notificationHandler from './notificationHandler';

// Default timeout in ms
const DEFAULT_TIMEOUT = 5000;

/**
 * CommandHandler manages sending commands to OBD devices
 * and processing their responses with proper timeout handling.
 */
class CommandHandler {
  private static instance: CommandHandler;
  private commandQueue: Array<() => Promise<void>> = [];
  private isProcessingCommand = false;
  private currentCommandTimeout: NodeJS.Timeout | null = null;
  private currentCommand: string | null = null;
  private commandSubject: Subject<{command: string, response: string}> = new Subject();
  
  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): CommandHandler {
    if (!CommandHandler.instance) {
      CommandHandler.instance = new CommandHandler();
    }
    return CommandHandler.instance;
  }

  /**
   * Send a command to the device and wait for a response
   * 
   * @param command The command to send
   * @param writeFn Function that performs the actual write to the device
   * @param deviceId ID of the connected device
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise that resolves to the device's response
   */
  async sendCommand(
    command: string,
    writeFn: () => Promise<void>,
    deviceId: string,
    timeoutMs: number = DEFAULT_TIMEOUT
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const executeCommand = async () => {
        try {
          const response = await this.executeCommandWithTimeout(
            command,
            writeFn,
            deviceId,
            timeoutMs
          );
          resolve(response);
        } catch (error) {
          reject(error);
        } finally {
          this.processNextCommand();
        }
      };

      // Add the command to the queue
      this.commandQueue.push(executeCommand);
      
      // If this is the only command, process it immediately
      if (this.commandQueue.length === 1 && !this.isProcessingCommand) {
        this.processNextCommand();
      }
    });
  }

  /**
   * Process the next command in the queue
   */
  private async processNextCommand(): Promise<void> {
    if (this.commandQueue.length === 0 || this.isProcessingCommand) {
      return;
    }

    this.isProcessingCommand = true;
    const nextCommand = this.commandQueue.shift();

    if (nextCommand) {
      await nextCommand();
    }

    this.isProcessingCommand = false;

    // If there are more commands, process the next one
    if (this.commandQueue.length > 0) {
      this.processNextCommand();
    }
  }

  /**
   * Execute a command with timeout handling
   */
  private async executeCommandWithTimeout(
    command: string,
    writeFn: () => Promise<void>,
    deviceId: string,
    timeoutMs: number
  ): Promise<string> {
    this.currentCommand = command;
    this.clearTimeout();
    try {
      // Get response stream for this device
      const responseStream = notificationHandler
        .getCompleteResponseStream(deviceId)
        .pipe(
          filter(response => isResponseComplete(response)),
          take(1)
        );
      // Create a timeout stream
      const timeoutError = new BluetoothOBDError(
        BluetoothErrorType.TIMEOUT_ERROR,
        `Command "${command}" timed out after ${timeoutMs}ms`
      );
      
      // Send the command
      await writeFn();
      
      // Race between response and timeout - ensure we always return a string
      const response = await firstValueFrom(
        responseStream.pipe(timeout({ 
          first: timeoutMs, 
          with: () => timer(0).pipe(
            take(1),
            filter(() => {
              throw timeoutError;
            })
          )
        }))
      );
      
      // Make sure we return a string
      return response !== 0 ? response : '';
    } catch (error) {
      if (error instanceof BluetoothOBDError) {
        throw error;
      }
      
      throw new BluetoothOBDError(
        BluetoothErrorType.WRITE_ERROR,
        `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.clearTimeout();
      this.currentCommand = null;
    }
  }

  /**
   * Clear any active timeout
   */
  private clearTimeout(): void {
    if (this.currentCommandTimeout) {
      clearTimeout(this.currentCommandTimeout);
      this.currentCommandTimeout = null;
    }
  }

  /**
   * Reset command handler state
   */
  reset(): void {
    this.clearTimeout();
    this.commandQueue = [];
    this.isProcessingCommand = false;
    this.currentCommand = null;
  }

  /**
   * Get an observable of command-response pairs
   */
  getCommandStream(): Observable<{command: string, response: string}> {
    return this.commandSubject.asObservable();
  }
}

export default CommandHandler.getInstance();
