import { NativeEventEmitter, NativeModules } from 'react-native';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { decodeData, isResponseComplete } from './dataUtils';
import { BluetoothOBDError, BluetoothErrorType } from './errorUtils';
import { StreamingStateManager } from './streamingStateManager';

export interface NotificationData {
  peripheral: string;
  value: number[];
  characteristic?: string;
  service?: string;
}

export interface RawResponse {
  bytes: number[];
  text: string;
}

function isNotificationData(event: unknown): event is NotificationData {
  return (
    typeof event === 'object' &&
    event !== null &&
    'value' in event &&
    Array.isArray((event as NotificationData).value) &&
    'peripheral' in event &&
    typeof (event as NotificationData).peripheral === 'string'
  );
}

/**
 * Global singleton notification handler for BLE responses
 * Coordinates with StreamingStateManager for timeout handling
 */
export class NotificationHandler {
  private static instance: NotificationHandler;
  private notificationSubject = new Subject<NotificationData>();
  private currentPeripheral: string | null = null;
  private responseBuffer = new Map<string, string>();
  private rawResponseBuffer = new Map<string, number[]>();
  private notificationListener: ReturnType<typeof NativeEventEmitter.prototype.addListener> | null =
    null;
  private streamingManager: StreamingStateManager;
  private globalWatchdogTimerId: NodeJS.Timeout | null = null;
  private isListening = false;

  private constructor() {
    // Get the singleton instance of the streaming manager
    this.streamingManager = StreamingStateManager.getInstance();

    // Initialize the global notification listener
    this.setupGlobalNotificationListener();

    // Set up the global streaming watchdog
    this.setupGlobalStreamingWatchdog();

    // Subscribe to streaming state changes
    this.streamingManager.onStreamStateChange((isStreaming: boolean) => {
      if (!isStreaming) {
        // Clean up buffers when streaming stops
        this.clearBuffers();
      }
    });
  }

  private setupGlobalNotificationListener(): void {
    if (this.isListening) return;

    const bleEmitter = new NativeEventEmitter(
      NativeModules.BleManager as unknown as typeof NativeModules,
    );
    this.notificationListener = bleEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      ((event: unknown) => {
        if (isNotificationData(event)) {
          // Process notification data
          if (event.peripheral === this.currentPeripheral) {
            // Reset streaming timeout since we received data
            this.streamingManager.resetStreamTimeout();

            // Update both raw and decoded buffers for this peripheral
            let buffer = this.responseBuffer.get(event.peripheral) || '';
            let rawBuffer = this.rawResponseBuffer.get(event.peripheral) || [];

            // Append raw bytes
            rawBuffer = [...rawBuffer, ...event.value];
            this.rawResponseBuffer.set(event.peripheral, rawBuffer);

            // Append decoded text
            const decodedValue = decodeData(event.value);
            buffer += decodedValue;

            // If we have a complete response, emit it and clear buffers
            if (isResponseComplete(buffer)) {
              this.notificationSubject.next({
                peripheral: event.peripheral,
                characteristic: '',
                service: '',
                value: rawBuffer, // Send complete raw buffer
              });
              this.responseBuffer.delete(event.peripheral);
              this.rawResponseBuffer.delete(event.peripheral);

              // Stop streaming since we got a complete response
              this.streamingManager.stopStreaming();
            } else {
              // Store partial response
              this.responseBuffer.set(event.peripheral, buffer);
            }
          }
        }
      }) as (event: unknown) => void,
    );

    this.isListening = true;
  }

  private setupGlobalStreamingWatchdog(): void {
    // Clear any existing watchdog
    this.clearGlobalWatchdog();

    // Set up a continuous watchdog that checks every second if we're in a streaming state
    this.globalWatchdogTimerId = setInterval(() => {
      // If we're streaming but haven't received data for too long, force stop the stream
      if (this.streamingManager.isStreamingActive()) {
        const duration = this.streamingManager.getStreamDuration();
        if (duration > this.streamingManager.getMaxStreamDuration()) {
          console.warn('[NotificationHandler] Global watchdog detected stalled stream, stopping');
          this.streamingManager.stopStreaming();
          this.clearBuffers();
        }
      }
    }, 1000); // Check every second
  }

  private clearGlobalWatchdog(): void {
    if (this.globalWatchdogTimerId) {
      clearInterval(this.globalWatchdogTimerId);
      this.globalWatchdogTimerId = null;
    }
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
        'Peripheral ID must be a string or null',
      );
    }
    this.currentPeripheral = peripheralId;
    this.clearBuffers();

    // Stop any ongoing streaming when changing peripherals
    if (this.streamingManager.isStreamingActive()) {
      this.streamingManager.stopStreaming();
    }
  }

  private clearBuffers(): void {
    if (this.currentPeripheral) {
      this.responseBuffer.delete(this.currentPeripheral);
      this.rawResponseBuffer.delete(this.currentPeripheral);
    }
  }

  getResponseStream(deviceId: string): Observable<RawResponse> {
    if (!deviceId) {
      throw new BluetoothOBDError(BluetoothErrorType.INVALID_PARAMETER, 'Device ID is required');
    }

    return this.notificationSubject.pipe(
      filter(data => data.peripheral === deviceId),
      map(data => {
        try {
          return {
            bytes: data.value,
            text: decodeData(data.value),
          };
        } catch (error) {
          throw new BluetoothOBDError(
            BluetoothErrorType.DATA_ERROR,
            `Failed to decode notification data: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }),
    );
  }

  getCompleteResponseStream(deviceId: string): Observable<RawResponse> {
    return this.getResponseStream(deviceId).pipe(
      filter(response => {
        try {
          return isResponseComplete(response.text);
        } catch (error) {
          throw new BluetoothOBDError(
            BluetoothErrorType.DATA_ERROR,
            `Failed to check response completion: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }),
    );
  }

  prepareForCommand(deviceId: string): void {
    // Set current peripheral
    this.setActivePeripheral(deviceId);

    // Start streaming state
    this.streamingManager.startStreaming();

    // Make sure our global listener is active
    this.setupGlobalNotificationListener();
  }

  reset(): void {
    this.clearBuffers();
    if (this.streamingManager.isStreamingActive()) {
      this.streamingManager.stopStreaming();
    }
  }

  cleanup(): void {
    // We don't fully remove the notification listener anymore
    // We keep it forever as a global singleton listener

    this.clearBuffers();
    this.currentPeripheral = null;

    // Stop streaming if active during cleanup
    if (this.streamingManager.isStreamingActive()) {
      this.streamingManager.stopStreaming();
    }
  }

  // For testing and debugging only
  forceResetGlobalListener(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    this.isListening = false;
    this.setupGlobalNotificationListener();
  }

  // This will be called when the app exits or is fully destroyed
  destroy(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    this.isListening = false;
    this.clearGlobalWatchdog();
    this.reset();
    NotificationHandler.instance = null as unknown as NotificationHandler;
  }
}

export default NotificationHandler.getInstance();
