import { NativeEventEmitter, NativeModules } from 'react-native';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { decodeData, isResponseComplete } from './dataUtils';
import { BluetoothOBDError, BluetoothErrorType } from './errorUtils';
import streamingManager from './streamingStateManager';

export interface NotificationData {
  peripheral: string;
  characteristic: string;
  service: string;
  value: number[];
}

export interface RawResponse {
  bytes: number[];
  text: string;
}

/**
 * Global singleton notification handler for BLE responses
 */
export class NotificationHandler {
  private static instance: NotificationHandler;
  private notificationSubject = new Subject<NotificationData>();
  private currentPeripheral: string | null = null;
  private responseBuffer = new Map<string, string>();
  private rawResponseBuffer = new Map<string, number[]>();
  private notificationListener: any;

  private constructor() {
    // Initialize the global notification listener
    const bleEmitter = new NativeEventEmitter(NativeModules.BleManager);
    this.notificationListener = bleEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      (data: NotificationData) => {
        if (data.peripheral === this.currentPeripheral) {
          // Reset streaming timeout since we received data
          streamingManager.resetStreamTimeout();
          
          // Update both raw and decoded buffers for this peripheral
          let buffer = this.responseBuffer.get(data.peripheral) || '';
          let rawBuffer = this.rawResponseBuffer.get(data.peripheral) || [];
          
          // Append raw bytes
          rawBuffer = [...rawBuffer, ...data.value];
          this.rawResponseBuffer.set(data.peripheral, rawBuffer);
          
          // Append decoded text
          const decodedValue = decodeData(data.value);
          buffer += decodedValue;
          
          // If we have a complete response, emit it and clear buffers
          if (isResponseComplete(buffer)) {
            this.notificationSubject.next({
              peripheral: data.peripheral,
              characteristic: data.characteristic,
              service: data.service,
              value: rawBuffer // Send complete raw buffer
            });
            this.responseBuffer.delete(data.peripheral);
            this.rawResponseBuffer.delete(data.peripheral);
            
            // Stop streaming since we got a complete response
            streamingManager.stopStreaming();
          } else {
            // Store partial response
            this.responseBuffer.set(data.peripheral, buffer);
          }
        }
      }
    );

    // Subscribe to streaming state changes
    streamingManager.onStreamStateChange((isStreaming) => {
      if (!isStreaming) {
        // Clean up buffers when streaming stops
        this.clearBuffers();
      }
    });
  }

  private clearBuffers(): void {
    if (this.currentPeripheral) {
      this.responseBuffer.delete(this.currentPeripheral);
      this.rawResponseBuffer.delete(this.currentPeripheral);
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
        'Peripheral ID must be a string or null'
      );
    }
    this.currentPeripheral = peripheralId;
    this.clearBuffers();
    
    // Stop any ongoing streaming when changing peripherals
    if (streamingManager.isStreamingActive()) {
      streamingManager.stopStreaming();
    }
  }

  getResponseStream(deviceId: string): Observable<RawResponse> {
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
          return {
            bytes: data.value,
            text: decodeData(data.value)
          };
        } catch (error) {
          throw new BluetoothOBDError(
            BluetoothErrorType.DATA_ERROR,
            `Failed to decode notification data: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
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
            `Failed to check response completion: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
    );
  }

  reset(): void {
    this.clearBuffers();
    if (streamingManager.isStreamingActive()) {
      streamingManager.stopStreaming();
    }
  }

  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    this.clearBuffers();
    this.currentPeripheral = null;
    
    // Stop streaming if active during cleanup
    if (streamingManager.isStreamingActive()) {
      streamingManager.stopStreaming();
    }
  }
}

export default NotificationHandler.getInstance();