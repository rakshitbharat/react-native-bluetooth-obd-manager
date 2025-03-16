/**
 * Error utilities for the Bluetooth OBD Manager
 */

// Error types
export enum BluetoothErrorType {
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  CHARACTERISTIC_ERROR = 'CHARACTERISTIC_ERROR',
  NOTIFICATION_ERROR = 'NOTIFICATION_ERROR',
  WRITE_ERROR = 'WRITE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  DISCONNECTION_ERROR = 'DISCONNECTION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Custom error class for Bluetooth OBD Manager errors
 */
export class BluetoothOBDError extends Error {
  type: BluetoothErrorType;
  details?: any;

  constructor(type: BluetoothErrorType, message: string, details?: any) {
    super(message);
    this.type = type;
    this.details = details;
    this.name = 'BluetoothOBDError';
  }
}

export const createBluetoothError = (type: BluetoothErrorType, message: string, details?: any): BluetoothOBDError => {
  return new BluetoothOBDError(type, message, details);
};

// Retry utility for notification operations
export const retryNotification = async (
  operation: () => Promise<any>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<any> => {
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
    lastError
  );
};

// Handle common Bluetooth errors
export const handleBluetoothError = (error: any): BluetoothOBDError => {
  if (error instanceof BluetoothOBDError) {
    return error;
  }

  const message = error.message || String(error);
  
  if (message.includes('permission')) {
    return new BluetoothOBDError(
      BluetoothErrorType.PERMISSION_ERROR,
      'Bluetooth permission denied',
      error
    );
  }
  
  if (message.includes('connect')) {
    return new BluetoothOBDError(
      BluetoothErrorType.CONNECTION_ERROR,
      'Failed to connect to device',
      error
    );
  }
  
  if (message.includes('service')) {
    return new BluetoothOBDError(
      BluetoothErrorType.SERVICE_ERROR,
      'Failed to find required service',
      error
    );
  }
  
  if (message.includes('characteristic')) {
    return new BluetoothOBDError(
      BluetoothErrorType.CHARACTERISTIC_ERROR,
      'Failed to find required characteristic',
      error
    );
  }
  
  if (message.includes('timeout')) {
    return new BluetoothOBDError(
      BluetoothErrorType.TIMEOUT_ERROR,
      'Operation timed out',
      error
    );
  }

  return new BluetoothOBDError(
    BluetoothErrorType.UNKNOWN_ERROR,
    'Unknown Bluetooth error occurred',
    error
  );
};

/**
 * Parse BLE Manager error and return a standardized error object
 * @param error Original error from BLE Manager or other source
 * @returns Standardized BluetoothOBDError
 */
export const parseBluetoothError = (error: any): BluetoothOBDError => {
  const errorMessage = error?.message || String(error);
  
  // Detect different types of errors based on the message content
  if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
    return new BluetoothOBDError(
      BluetoothErrorType.PERMISSION_ERROR,
      `Bluetooth permission denied: ${errorMessage}`,
      error
    );
  }
  
  if (errorMessage.includes('disconnect') || errorMessage.includes('Disconnect')) {
    return new BluetoothOBDError(
      BluetoothErrorType.CONNECTION_ERROR,
      `Device disconnected: ${errorMessage}`,
      error
    );
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return new BluetoothOBDError(
      BluetoothErrorType.TIMEOUT_ERROR,
      `Operation timed out: ${errorMessage}`,
      error
    );
  }
  
  if (errorMessage.includes('compatible') || errorMessage.includes('Compatible')) {
    return new BluetoothOBDError(
      BluetoothErrorType.COMPATIBILITY_ERROR,
      `Device compatibility issue: ${errorMessage}`,
      error
    );
  }
  
  if (errorMessage.includes('initialize') || errorMessage.includes('Initialize')) {
    return new BluetoothOBDError(
      BluetoothErrorType.INITIALIZATION_ERROR,
      `Initialization error: ${errorMessage}`,
      error
    );
  }
  
  return new BluetoothOBDError(`Bluetooth error: ${errorMessage}`);
};

/**
 * Log error with standard format
 * @param error Error to log
 * @param context Optional context information
 */
export const logBluetoothError = (error: any, context?: string): void => {
  const parsedError = error instanceof BluetoothOBDError 
    ? error 
    : parseBluetoothError(error);
    
  const contextPrefix = context ? `[${context}] ` : '';
  console.error(
    `${contextPrefix}${parsedError.name} [${parsedError.type}]: ${parsedError.message}`
  );
};

export const attemptRecovery = async (
  error: any,
  retryFn: () => Promise<any>,
  maxAttempts: number = 3
): Promise<any> => {
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

export const isRecoverableError = (error: any): boolean => {
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
