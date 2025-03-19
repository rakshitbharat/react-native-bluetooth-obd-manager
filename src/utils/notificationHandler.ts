import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { decodeData, isResponseComplete } from './dataUtils';
import { BluetoothOBDError, BluetoothErrorType } from './errorUtils';

export interface NotificationData {
  peripheral: string;
  characteristic: string;
  service: string;
  value: number[];
}

export interface NotificationOptions {
  bufferSize?: number;
  debounceTime?: number;
}

export class NotificationHandler {
  private static instance: NotificationHandler;
  private notificationSubject: Subject<NotificationData>;
  private currentPeripheral: string | null = null;
  private readonly DEFAULT_BUFFER_SIZE = 1024;

  private constructor() {
    this.notificationSubject = new Subject<NotificationData>();
  }

  static getInstance(): NotificationHandler {
    if (!NotificationHandler.instance) {
      NotificationHandler.instance = new NotificationHandler();
    }
    return NotificationHandler.instance;
  }

  setActivePeripheral(peripheralId: string | null): void {
    if (peripheralId && typeof peripheralId !== 'string') {
      throw new BluetoothOBDError(
        BluetoothErrorType.INVALID_PARAMETER,
        'Peripheral ID must be a string or null'
      );
    }
    this.currentPeripheral = peripheralId;
  }

  handleNotification(data: NotificationData): void {
    if (!data || !data.peripheral) {
      throw new BluetoothOBDError(
        BluetoothErrorType.INVALID_PARAMETER,
        'Invalid notification data'
      );
    }

    if (this.currentPeripheral && data.peripheral === this.currentPeripheral) {
      try {
        this.notificationSubject.next(data);
      } catch (error) {
        throw new BluetoothOBDError(
          BluetoothErrorType.NOTIFICATION_ERROR,
          `Failed to handle notification: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  getResponseStream(deviceId: string): Observable<string> {
    if (!deviceId) {
      throw new BluetoothOBDError(
        BluetoothErrorType.INVALID_PARAMETER,
        'Device ID is required'
      );
    }

    return this.notificationSubject.pipe(
      filter(data => data.peripheral === deviceId),
      map(data => {
        try {
          return decodeData(data.value);
        } catch (error) {
          throw new BluetoothOBDError(
            BluetoothErrorType.DATA_ERROR,
            `Failed to decode notification data: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
    );
  }

  getCompleteResponseStream(deviceId: string): Observable<string> {
    return this.getResponseStream(deviceId).pipe(
      filter(response => {
        try {
          return isResponseComplete(response);
        } catch (error) {
          throw new BluetoothOBDError(
            BluetoothErrorType.DATA_ERROR,
            `Failed to check response completion: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
    );
  }

  reset(): void {
    this.currentPeripheral = null;
    // Clear any pending notifications
    try {
      this.notificationSubject.complete();
      this.notificationSubject = new Subject<NotificationData>();
    } catch (error) {
      console.warn('Error during notification handler reset:', error);
    }
  }
}

export default NotificationHandler.getInstance();