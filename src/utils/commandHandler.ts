import { BluetoothOBDError, BluetoothErrorType } from './errorUtils';
import { decodeData, encodeCommand } from './dataUtils';
import NotificationHandler from './notificationHandler';
import { firstValueFrom, race, timer } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

export class CommandHandler {
  private static instance: CommandHandler;
  private lastCommand: string | null = null;
  private notificationHandler: typeof NotificationHandler;
  private responseBuffer: string = '';
  private readonly COMMAND_TIMEOUT = 4000; // 4 seconds

  private constructor() {
    this.notificationHandler = NotificationHandler.getInstance();
  }

  static getInstance(): CommandHandler {
    if (!CommandHandler.instance) {
      CommandHandler.instance = new CommandHandler();
    }
    return CommandHandler.instance;
  }

  async sendCommand(
    command: string,
    writeFn: (bytes: number[]) => Promise<void>,
    deviceId: string,
    timeoutMs: number = this.COMMAND_TIMEOUT
  ): Promise<string> {
    // Clear any existing response
    this.responseBuffer = '';
    this.lastCommand = command;

    // Prepare command bytes
    const cmdWithCR = command.endsWith('\r') ? command : `${command}\r`;
    const bytes = encodeCommand(cmdWithCR);

    try {
      // Setup response stream with timeout
      const responsePromise = firstValueFrom(
        this.notificationHandler.getCompleteResponseStream(deviceId).pipe(
          map(response => {
            this.responseBuffer += response;
            if (this.isResponseComplete(this.responseBuffer)) {
              return this.cleanResponse(this.responseBuffer);
            }
            throw new Error('Incomplete response');
          }),
          filter(response => !!response),
          takeUntil(timer(timeoutMs))
        )
      );

      // Send command
      await writeFn(bytes);

      // Wait for response or timeout
      const response = await Promise.race([
        responsePromise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new BluetoothOBDError(
            BluetoothErrorType.TIMEOUT_ERROR,
            `Command ${command} timed out after ${timeoutMs}ms`
          )), timeoutMs)
        )
      ]);

      return response;

    } catch (error) {
      if (error instanceof BluetoothOBDError) {
        throw error;
      }
      throw new BluetoothOBDError(
        BluetoothErrorType.WRITE_ERROR,
        `Failed to send command ${command}: ${error.message}`
      );
    }
  }

  private isResponseComplete(response: string): boolean {
    // Response is complete if it contains '>' prompt
    // or if it's a known complete response (like "OK" or "NO DATA")
    return (
      response.includes('>') ||
      response.includes('OK') ||
      response.includes('NO DATA') ||
      response.includes('ERROR')
    );
  }

  private cleanResponse(response: string): string {
    // Remove command echo if present
    if (this.lastCommand) {
      response = response.replace(this.lastCommand, '');
    }

    // Remove prompt character
    response = response.replace('>', '');

    // Remove carriage returns and line feeds
    response = response.replace(/[\r\n]/g, '');

    // Remove any remaining whitespace
    return response.trim();
  }

  reset(): void {
    this.lastCommand = null;
    this.responseBuffer = '';
  }
}

export default CommandHandler.getInstance();