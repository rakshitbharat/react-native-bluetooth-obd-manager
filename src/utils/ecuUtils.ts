import { TextDecoder, TextEncoder } from 'text-encoding';

import { log } from './logger';

// More specific input types
type NumberArray = number[] | number[][];
type ValidInput = string | Uint8Array | NumberArray;
type BytesInput = ValidInput | null | undefined;

// Type guard functions
const isNumberArray = (input: unknown): input is NumberArray => {
  return (
    Array.isArray(input) &&
    input.every(
      item =>
        typeof item === 'number' ||
        (Array.isArray(item) && item.every(num => typeof num === 'number')),
    )
  );
};

const isValidInput = (input: unknown): input is ValidInput => {
  return (
    typeof input === 'string' ||
    input instanceof Uint8Array ||
    isNumberArray(input)
  );
};

// Utility helper functions
const validateInput = (input: unknown, fnName: string): void => {
  if (input == null) {
    log.warn(`[ecuUtils] ${fnName} received null/undefined input`);
    return;
  }
  if (!isValidInput(input)) {
    log.error(
      `[ecuUtils] ${fnName} received invalid input type: ${typeof input}`,
    );
  }
};

const flatten = (arr: unknown): number[] => {
  if (!Array.isArray(arr)) return [];

  return arr.reduce<number[]>((acc, item) => {
    if (Array.isArray(item)) {
      return [...acc, ...flatten(item)];
    }
    const num = Number(item);
    return !isNaN(num) && isFinite(num) ? [...acc, num & 0xff] : acc;
  }, []);
};

/**
 * Convert hex string to byte array (Uint8Array).
 *
 * @param hex - Hex string to convert (can include spaces, non-hex chars filtered)
 * @returns Uint8Array containing decoded bytes
 * @example
 * ```typescript
 * // Convert hex string to bytes
 * const bytes = hexToBytes('48 65 6C 6C 6F');
 * log.log(bytes); // Uint8Array [72, 101, 108, 108, 111]
 * ```
 */
export const hexToBytes = (input: BytesInput): Uint8Array => {
  validateInput(input, 'hexToBytes');
  if (!input) return new Uint8Array(0);

  // If already Uint8Array, return as is
  if (input instanceof Uint8Array) return input;

  // If number array, convert directly
  if (Array.isArray(input)) {
    return new Uint8Array(input.map(n => Number(n) & 0xff));
  }

  // Handle string input
  const cleanedHex = input.replace(/[^0-9a-fA-F]/g, '');

  if (cleanedHex.length % 2 !== 0) {
    void log.warn(
      // Use void for fire-and-forget async log
      `[ecuUtils] hexToBytes received hex string with odd length: ${input}`,
    );
    // Do not pad - caller should handle odd length if necessary
  }

  const bytes = new Uint8Array(Math.floor(cleanedHex.length / 2));

  for (let i = 0; i < bytes.length; i++) {
    const start = i * 2;
    const byteHex = cleanedHex.substring(start, start + 2);
    // Handle potential parsing errors
    const byteVal = parseInt(byteHex, 16);
    if (isNaN(byteVal)) {
      void log.error(
        `[ecuUtils] Invalid hex byte detected: ${byteHex} in ${input}`,
      );
      // Return partially converted array or throw? For now, set to 0.
      bytes[i] = 0;
    } else {
      bytes[i] = byteVal;
    }
  }

  return bytes;
};

/**
 * Convert byte array to hex string.
 * Always returns uppercase hex with padding.
 *
 * @param bytes - Array of byte values to convert
 * @returns Uppercase hex string
 * @example
 * ```typescript
 * // Convert bytes to hex string
 * const hex = bytesToHex([72, 101, 108, 108, 111]);
 * log.log(hex); // "48656C6C6F"
 * ```
 */
export const bytesToHex = (input: BytesInput): string => {
  validateInput(input, 'bytesToHex');
  if (!input) return '';

  // Handle special cases with type guards
  if (typeof input === 'string') {
    return input.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  }

  try {
    const bytes =
      input instanceof Uint8Array
        ? Array.from(input)
        : flatten(input as NumberArray);

    return bytes
      .map(byte => {
        const num = Number(byte) & 0xff;
        return num.toString(16).padStart(2, '0');
      })
      .join('')
      .toUpperCase();
  } catch (error) {
    log.error('[ecuUtils] bytesToHex conversion failed:', error);
    return '';
  }
};

/**
 * Convert byte array to string using UTF-8 or ISO-8859-1.
 * Handles potential errors during decoding.
 * Tries UTF-8 first, falls back to ISO-8859-1 which covers more byte values.
 *
 * @param bytes - Array of byte values to convert to string
 * @returns Decoded string, empty string on error
 * @example
 * ```typescript
 * // Convert bytes to string
 * const text = bytesToString(new Uint8Array([72, 101, 108, 108, 111]));
 * log.log(text); // "Hello"
 * ```
 */
export const bytesToString = (input: BytesInput): string => {
  validateInput(input, 'bytesToString');
  if (!input) return '';

  // If already string, return as is
  if (typeof input === 'string') return input;

  try {
    const bytes =
      input instanceof Uint8Array
        ? input
        : new Uint8Array(flatten(input as NumberArray));

    // Try UTF-8 first
    const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
    const decoded = utf8Decoder.decode(bytes);

    // If UTF-8 worked without replacement chars, return it
    if (!decoded.includes('\uFFFD')) return decoded;

    // Try Latin1 as fallback
    const latin1Decoder = new TextDecoder('iso-8859-1');
    return latin1Decoder.decode(bytes);
  } catch (error) {
    log.error('[ecuUtils] String decode failed:', error);
    // Final fallback - direct ASCII conversion
    try {
      const validBytes = flatten(input).filter(b => b >= 0 && b <= 255);
      return String.fromCharCode(...validBytes);
    } catch (fallbackError) {
      log.error('[ecuUtils] ASCII fallback failed:', fallbackError);
      return '';
    }
  }
};

/**
 * Convert string to byte array using UTF-8.
 * Includes fallback to basic ASCII if UTF-8 encoding fails.
 *
 * @param str - String to convert to bytes
 * @returns Uint8Array containing encoded bytes
 * @example
 * ```typescript
 * // Convert string to bytes
 * const bytes = stringToBytes("Hello");
 * log.log(bytes); // Uint8Array [72, 101, 108, 108, 111]
 * ```
 */
export const stringToBytes = (input: BytesInput): Uint8Array => {
  validateInput(input, 'stringToBytes');
  if (!input) return new Uint8Array(0);

  // If already Uint8Array, return as is
  if (input instanceof Uint8Array) return input;

  if (Array.isArray(input)) {
    return new Uint8Array(flatten(input));
  }

  try {
    const encoder = new TextEncoder();
    return encoder.encode(input as string);
  } catch (error) {
    log.error('[ecuUtils] UTF-8 encode failed:', error);
    // Fallback: Basic ASCII conversion
    try {
      const bytes = new Uint8Array(input.length);
      for (let i = 0; i < input.length; i++) {
        // Get char code, ensure it's within byte range
        bytes[i] = input.charCodeAt(i) & 0xff;
      }
      return bytes;
    } catch (fallbackError: unknown) {
      const fallbackErrorMsg =
        fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
      void log.error('[ecuUtils] Final fallback encoding error:', {
        error: fallbackErrorMsg,
      });
      return new Uint8Array(0); // Return empty if all encoding fails
    }
  }
};

/**
 * Format number as hex string with padding.
 *
 * @param num - Number to convert to hex
 * @param width - Minimum width for padding with zeros
 * @returns Uppercase hex string padded to specified width
 * @example
 * ```typescript
 * // Convert number to padded hex
 * const hex = toHexString(26, 4);
 * log.log(hex); // "001A"
 * ```
 */
export const toHexString = (input: BytesInput | number, width = 2): string => {
  validateInput(input, 'toHexString');
  if (input == null) return ''.padStart(width, '0');

  // Handle number directly
  if (typeof input === 'number') {
    return Math.max(0, Math.floor(input))
      .toString(16)
      .toUpperCase()
      .padStart(width, '0');
  }

  // Handle string - try to parse as number first
  if (typeof input === 'string') {
    const num = parseInt(input, 16);
    if (!isNaN(num)) {
      return toHexString(num, width);
    }
    // If not a valid hex, convert string to bytes then to hex
    return bytesToHex(stringToBytes(input));
  }

  // Handle byte arrays
  return bytesToHex(input);
};

/**
 * Cleans up an ELM327 response by:
 * 1. Removing echo of the command (if present)
 * 2. Removing prompt characters ('>')
 * 3. Trimming whitespace
 * 4. Removing any empty lines
 */
export const cleanElmResponse = (
  input: BytesInput,
  command?: string,
): string => {
  validateInput(input, 'cleanElmResponse');
  if (!input) return '';

  // Convert to string if needed
  const strResponse = typeof input === 'string' ? input : bytesToString(input);

  // Split into lines and filter out empty ones
  const lines = strResponse
    .split(/[\r\n]+/)
    .filter(line => line.trim().length > 0);

  // Remove echo of the command if present
  const filteredLines = lines.filter(line => {
    // Skip any line that matches the command
    if (command && line.toUpperCase().includes(command.toUpperCase())) {
      return false;
    }
    return true;
  });

  // Remove prompt characters and trim
  return filteredLines
    .map(line => line.replace(/>/g, '').trim())
    .join('\n')
    .trim();
};
