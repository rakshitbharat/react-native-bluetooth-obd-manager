import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { decodeData, isResponseComplete } from './dataUtils';

interface NotificationData {
  peripheral: string;
  characteristic: string;
  service: string;
  value: number[];
}

export class NotificationHandler {
  private static instance: NotificationHandler;
  private notificationSubject: Subject<NotificationData>;
  private currentPeripheral: string | null = null;

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
    this.currentPeripheral = peripheralId;
  }

  handleNotification(data: NotificationData): void {
    if (this.currentPeripheral && data.peripheral === this.currentPeripheral) {
      this.notificationSubject.next(data);
    }
  }

  getResponseStream(deviceId: string): Observable<string> {
    return this.notificationSubject.pipe(
      filter(data => data.peripheral === deviceId),
      map(data => decodeData(data.value))
    );
  }

  getCompleteResponseStream(deviceId: string): Observable<string> {
    return this.getResponseStream(deviceId).pipe(
      filter(response => isResponseComplete(response))
    );
  }

  reset(): void {
    this.currentPeripheral = null;
  }
}

export default NotificationHandler.getInstance();