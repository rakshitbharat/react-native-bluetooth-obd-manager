/**
 * Error utilities for the Bluetooth OBD Manager
 */

// Error types specific to Bluetooth OBD operations
export enum BluetoothErrorType {
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  CHARACTERISTIC_ERROR = 'CHARACTERISTIC_ERROR',
  NOTIFICATION_ERROR = 'NOTIFICATION_ERROR',
  WRITE_ERROR = 'WRITE_ERROR',
  READ_ERROR = 'READ_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  DEVICE_ERROR = 'DEVICE_ERROR',
  DISCONNECTION_ERROR = 'DISCONNECTION_ERROR',
  COMPATIBILITY_ERROR = 'COMPATIBILITY_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  INCOMPLETE_RESPONSE = 'INCOMPLETE_RESPONSE',
  DATA_ERROR = 'DATA_ERROR',
  SCAN_ERROR = 'SCAN_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OBD_DATA_ERROR = 'OBD_DATA_ERROR',
}

/**
 * Custom error class for Bluetooth OBD operations
 */
export class BluetoothOBDError extends Error {
  type: BluetoothErrorType;
  originalError?: Error | unknown;
  details?: unknown;

  constructor(type: BluetoothErrorType, message: string, originalError?: Error | unknown) {
    super(message);
    this.name = 'BluetoothOBDError';
    this.type = type;
    this.originalError = originalError;
  }
}

/**
 * Common OBD error messages that might be encountered
 */
export const OBD_ERROR_MESSAGES = {
  NO_DATA: 'NO DATA',
  UNABLE_TO_CONNECT: 'UNABLE TO CONNECT',
  SEARCHING: 'SEARCHING...',
  ERROR: 'ERROR',
  STOPPED: 'STOPPED',
  CAN_ERROR: 'CAN ERROR',
  BUS_ERROR: 'BUS ERROR',
  BUS_BUSY: 'BUS BUSY',
  FB_ERROR: 'FB ERROR',
  DATA_ERROR: 'DATA ERROR',
  BUFFER_FULL: 'BUFFER FULL',
  UNKNOWN_COMMAND: '?',
};

/**
 * Log Bluetooth errors with proper categorization
 * @param error Error object
 * @param source Source of the error (optional)
 */
export const logBluetoothError = (error: unknown, context?: string): void => {
  let type = 'UNKNOWN';
  let message = '';
  let details: unknown = undefined;

  if (error instanceof BluetoothOBDError) {
    type = error.type;
    message = error.message;
    details = error.details;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }

  const contextPrefix = context ? `[${context}] ` : '';
  console.error(`${contextPrefix}[Bluetooth Error][${type}]:`, message, details);
};

/**
 * Log OBD data errors with proper categorization
 * @param message Error message
 * @param error Error object (optional)
 */
export const logOBDDataError = (message: string, error?: Error | null): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[OBD Data Error] ${message}`, error);
  }
};

/**
 * Check if a response contains an OBD error
 * @param response The response from the OBD device
 * @returns True if the response contains an error
 */
export const containsOBDError = (response: string): boolean => {
  if (!response) return false;

  const upperResponse = response.toUpperCase();
  return Object.values(OBD_ERROR_MESSAGES).some(msg => upperResponse.includes(msg));
};

/**
 * Get a friendly error message for users based on the error type
 * @param error The BluetoothOBDError object
 * @returns A user-friendly error message
 */
export const getFriendlyErrorMessage = (error: BluetoothOBDError): string => {
  switch (error.type) {
    case BluetoothErrorType.INITIALIZATION_ERROR:
      return 'Failed to initialize Bluetooth. Please restart the app.';

    case BluetoothErrorType.PERMISSION_ERROR:
      return 'Bluetooth permission denied. Please enable Bluetooth permissions in settings.';

    case BluetoothErrorType.CONNECTION_ERROR:
      return "Failed to connect to the OBD device. Please ensure it's powered on and try again.";

    case BluetoothErrorType.SERVICE_ERROR:
      return 'Failed to find required Bluetooth services on the device.';

    case BluetoothErrorType.CHARACTERISTIC_ERROR:
      return 'Failed to find required Bluetooth characteristics on the device.';

    case BluetoothErrorType.NOTIFICATION_ERROR:
      return 'Failed to receive notifications from the OBD device.';

    case BluetoothErrorType.WRITE_ERROR:
      return 'Failed to send command to the OBD device.';

    case BluetoothErrorType.READ_ERROR:
      return 'Failed to read data from the OBD device.';

    case BluetoothErrorType.TIMEOUT_ERROR:
      return 'Command timed out. The OBD device did not respond in time.';

    case BluetoothErrorType.PROTOCOL_ERROR:
      return 'OBD protocol error. The device may not support this vehicle or command.';

    case BluetoothErrorType.DEVICE_ERROR:
      return 'OBD device error. The device may be malfunctioning.';

    case BluetoothErrorType.DISCONNECTION_ERROR:
      return 'The OBD device was disconnected unexpectedly.';

    case BluetoothErrorType.COMPATIBILITY_ERROR:
      return 'The OBD device may not be compatible with your vehicle.';

    default:
      return error.message || 'An unknown error occurred.';
  }
};

/**
 * Handle common OBD errors with appropriate actions
 * @param error The error to handle
 * @param onRetry Function to call to retry the operation
 * @param onDisconnect Function to call to disconnect
 * @returns True if the error was handled
 */
export const handleOBDError = (
  error: unknown,
  onRetry?: () => void,
  onDisconnect?: () => void,
): boolean => {
  if (!(error instanceof BluetoothOBDError)) {
    return false;
  }

  switch (error.type) {
    case BluetoothErrorType.TIMEOUT_ERROR:
      // For timeout errors, we might want to retry
      if (onRetry) {
        setTimeout(onRetry, 1000);
        return true;
      }
      break;

    case BluetoothErrorType.CONNECTION_ERROR:
    case BluetoothErrorType.DISCONNECTION_ERROR:
      // For connection errors, we should disconnect
      if (onDisconnect) {
        onDisconnect();
        return true;
      }
      break;

    default:
      return false;
  }

  return false;
};

/**
 * Create a standardized Bluetooth error object
 */
export const createBluetoothError = (
  type: BluetoothErrorType,
  message: string,
  details?: unknown,
): BluetoothOBDError => {
  return new BluetoothOBDError(type, message, details);
};

/**
 * Retry a notification operation with exponential backoff
 */
export const retryNotification = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Notification attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) break;

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new BluetoothOBDError(
    BluetoothErrorType.NOTIFICATION_ERROR,
    `Operation failed after ${maxRetries} attempts`,
    lastError,
  );
};

/**
 * Parse BLE Manager error and return a standardized error object
 * @param error Original error from BLE Manager or other source
 * @returns Standardized BluetoothOBDError
 */
export const parseBluetoothError = (error: unknown): BluetoothOBDError => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Detect different types of errors based on the message content
  if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
    return new BluetoothOBDError(
      BluetoothErrorType.PERMISSION_ERROR,
      `Bluetooth permission denied: ${errorMessage}`,
      error,
    );
  }

  if (errorMessage.includes('disconnect') || errorMessage.includes('Disconnect')) {
    return new BluetoothOBDError(
      BluetoothErrorType.DISCONNECTION_ERROR,
      `Device disconnected: ${errorMessage}`,
      error,
    );
  }

  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return new BluetoothOBDError(
      BluetoothErrorType.TIMEOUT_ERROR,
      `Operation timed out: ${errorMessage}`,
      error,
    );
  }

  if (errorMessage.includes('compatible') || errorMessage.includes('Compatible')) {
    return new BluetoothOBDError(
      BluetoothErrorType.COMPATIBILITY_ERROR,
      `Device compatibility issue: ${errorMessage}`,
      error,
    );
  }

  if (errorMessage.includes('initialize') || errorMessage.includes('Initialize')) {
    return new BluetoothOBDError(
      BluetoothErrorType.INITIALIZATION_ERROR,
      `Initialization error: ${errorMessage}`,
      error,
    );
  }

  return new BluetoothOBDError(
    BluetoothErrorType.UNKNOWN_ERROR,
    `Bluetooth error: ${errorMessage}`,
    error,
  );
};

/**
 * Attempt to recover from an error with retries
 */
export const attemptRecovery = async <T>(
  error: unknown,
  retryFn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> => {
  let attempts = 0;
  let lastError = error;

  while (attempts < maxAttempts) {
    try {
      return await retryFn();
    } catch (e) {
      lastError = e;
      attempts++;

      // Wait longer between each retry
      await new Promise(resolve => setTimeout(resolve, attempts * 1000));
    }
  }

  throw lastError;
};

/**
 * Determine if an error is recoverable
 */
export const isRecoverableError = (error: unknown): boolean => {
  if (error instanceof BluetoothOBDError) {
    switch (error.type) {
      case BluetoothErrorType.CONNECTION_ERROR:
      case BluetoothErrorType.SERVICE_ERROR:
      case BluetoothErrorType.WRITE_ERROR:
      case BluetoothErrorType.TIMEOUT_ERROR:
        return true;
      default:
        return false;
    }
  }
  return false;
};
