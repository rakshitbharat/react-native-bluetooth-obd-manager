import { TextDecoder, TextEncoder } from 'text-encoding';

import { log } from './logger';

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
export const hexToBytes = (hex: string): Uint8Array => {
  const cleanedHex = hex.replace(/[^0-9a-fA-F]/g, ''); // Remove non-hex chars and spaces

  if (cleanedHex.length % 2 !== 0) {
    void log.warn(
      // Use void for fire-and-forget async log
      `[ecuUtils] hexToBytes received hex string with odd length: ${hex}`,
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
        `[ecuUtils] Invalid hex byte detected: ${byteHex} in ${hex}`,
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
export const bytesToHex = (bytes: Uint8Array | number[]): string => {
  // Handle null/undefined input gracefully
  if (!bytes) return '';
  // Ensure input is an array-like structure
  if (!Array.isArray(bytes) && !(bytes instanceof Uint8Array)) {
    void log.warn(
      `[ecuUtils] bytesToHex received non-array input: ${typeof bytes}`,
    );
    return '';
  }
  return Array.from(bytes)
    .map(b => {
      // Ensure 'b' is a number before conversion
      const num = Number(b);
      if (isNaN(num)) {
        void log.warn(
          `[ecuUtils] bytesToHex encountered non-numeric value: ${b}`,
        );
        return '00'; // Or throw error? Default to '00'
      }
      // Ensure byte value is within range 0-255
      const validByte = Math.max(0, Math.min(255, Math.floor(num)));
      return validByte.toString(16).padStart(2, '0');
    })
    .join('')
    .toUpperCase();
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
export const bytesToString = (
  bytes: Uint8Array | number[] | null | undefined,
): string => {
  if (!bytes || bytes.length === 0) {
    return '';
  }

  try {
    // Ensure we have a Uint8Array of numbers
    // Flatten nested arrays if necessary (from JS byteArrayToString)
    const flatten = (arr: (number | number[])[]): number[] => {
      return arr.reduce<number[]>((flat, item) => {
        return flat.concat(
          Array.isArray(item) ? flatten(item) : [Number(item)],
        );
      }, []);
    };

    const numericArray = Array.isArray(bytes)
      ? flatten(bytes as (number | number[])[])
      : Array.from(bytes).map(Number);
    const uint8Array = new Uint8Array(numericArray.filter(n => !isNaN(n)));

    // Try UTF-8 first
    const decoderUtf8 = new TextDecoder('utf-8', { fatal: false }); // fatal: false allows partial decoding
    let decodedString = decoderUtf8.decode(uint8Array);

    // Check if UTF-8 decoding resulted in replacement characters (often indicates wrong encoding)
    // If it contains replacement characters, try Latin1 instead.
    if (decodedString.includes('\uFFFD')) {
      // Fallback to ISO-8859-1 (Latin1)
      const decoderLatin1 = new TextDecoder('iso-8859-1');
      decodedString = decoderLatin1.decode(uint8Array);
    }

    // Filter out null bytes (\0) and potentially other non-printables AFTER decoding
    // Also trim leading/trailing whitespace and control chars that might remain
    return decodedString
      .replace(/\0/g, '') // Remove null bytes
      .replace(/[^\x20-\x7E]/g, '') // Remove non-printable chars (keep only printable ASCII)
      .trim();
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    void log.error('[ecuUtils] Error decoding bytes to string:', {
      error: errorMsg,
    });
    // Final fallback: manual ASCII conversion for printable chars only
    try {
      const printableBytes = Array.from(bytes).filter(
        b => typeof b === 'number' && b >= 32 && b < 127,
      ) as number[];
      return String.fromCharCode(...printableBytes);
    } catch (fallbackError: unknown) {
      const fallbackErrorMsg =
        fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
      void log.error('[ecuUtils] Final fallback decoding error:', {
        error: fallbackErrorMsg,
      });
      return ''; // Return empty if all decoding fails
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
export const stringToBytes = (str: string | null | undefined): Uint8Array => {
  if (!str) {
    return new Uint8Array(0);
  }

  try {
    const encoder = new TextEncoder(); // Always UTF-8

    return encoder.encode(str);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    void log.error('[ecuUtils] Error encoding string to bytes:', {
      error: errorMsg,
    });
    // Fallback: Basic ASCII conversion
    try {
      const bytes = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        // Get char code, ensure it's within byte range
        bytes[i] = str.charCodeAt(i) & 0xff;
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
export const toHexString = (
  num: number | null | undefined,
  width: number = 2,
): string => {
  if (typeof num !== 'number' || isNaN(num)) {
    // Allow null/undefined to return empty string? Or padded zeros? Let's stick to padded zeros.
    // void log.warn(`[ecuUtils] toHexString received non-numeric input: ${num}`);
    return ''.padStart(width, '0'); // Return padded zeros
  }
  // Ensure number is non-negative before conversion
  const nonNegativeNum = Math.max(0, num);
  return Math.floor(nonNegativeNum)
    .toString(16)
    .toUpperCase()
    .padStart(width, '0');
};

/**
 * Cleans up an ELM327 response by:
 * 1. Removing echo of the command (if present)
 * 2. Removing prompt characters ('>')
 * 3. Trimming whitespace
 * 4. Removing any empty lines
 */
export const cleanElmResponse = (response: string, command?: string): string => {
  // Split into lines and filter out empty ones
  const lines = response.split(/[\r\n]+/).filter(line => line.trim().length > 0);
  
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
