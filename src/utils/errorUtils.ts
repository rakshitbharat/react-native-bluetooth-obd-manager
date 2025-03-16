/**
 * Error utilities for the Bluetooth OBD Manager
 */

// Error types
export enum BluetoothErrorType {
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  COMMUNICATION_ERROR = 'COMMUNICATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  COMPATIBILITY_ERROR = 'COMPATIBILITY_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class for Bluetooth OBD Manager errors
 */
export class BluetoothOBDError extends Error {
  type: BluetoothErrorType;
  
  constructor(message: string, type: BluetoothErrorType = BluetoothErrorType.UNKNOWN_ERROR) {
    super(message);
    this.name = 'BluetoothOBDError';
    this.type = type;
    
    // This is needed for proper instanceof checks in TypeScript with custom errors
    Object.setPrototypeOf(this, BluetoothOBDError.prototype);
  }
}

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
      `Bluetooth permission denied: ${errorMessage}`, 
      BluetoothErrorType.PERMISSION_ERROR
    );
  }
  
  if (errorMessage.includes('disconnect') || errorMessage.includes('Disconnect')) {
    return new BluetoothOBDError(
      `Device disconnected: ${errorMessage}`, 
      BluetoothErrorType.CONNECTION_ERROR
    );
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return new BluetoothOBDError(
      `Operation timed out: ${errorMessage}`, 
      BluetoothErrorType.TIMEOUT_ERROR
    );
  }
  
  if (errorMessage.includes('compatible') || errorMessage.includes('Compatible')) {
    return new BluetoothOBDError(
      `Device compatibility issue: ${errorMessage}`, 
      BluetoothErrorType.COMPATIBILITY_ERROR
    );
  }
  
  if (errorMessage.includes('initialize') || errorMessage.includes('Initialize')) {
    return new BluetoothOBDError(
      `Initialization error: ${errorMessage}`, 
      BluetoothErrorType.INITIALIZATION_ERROR
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
