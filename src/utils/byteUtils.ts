import type { ChunkedResponse } from '../types'; // Keep for isChunkedResponse if needed elsewhere
import { bytesToString } from './ecuUtils';

// Type guard might still be useful for external checks
export function isChunkedResponse(value: unknown): value is ChunkedResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'chunks' in value &&
    Array.isArray((value as ChunkedResponse).chunks) &&
    'rawResponse' in value && // Add check for rawResponse
    Array.isArray((value as ChunkedResponse).rawResponse)
  );
}

// Update functions to accept a compatible structure
interface ChunkContainer {
  chunks: Uint8Array[];
}

export function concatenateChunks(container: ChunkContainer): Uint8Array {
  // Calculate total length
  let totalLength = 0;
  container.chunks.forEach(chunk => {
    totalLength += chunk.length;
  });

  // Create final array
  const combinedArray = new Uint8Array(totalLength);
  let offset = 0;
  container.chunks.forEach(chunk => {
    combinedArray.set(chunk, offset);
    offset += chunk.length;
  });

  return combinedArray;
}

export function chunksToString(container: ChunkContainer): string {
  const combined = concatenateChunks(container);
  return bytesToString(combined);
}

/**
 * Converts an array of numbers (bytes) into a Uint8Array.
 *
 * @param {number[]} bytes The array of numbers representing bytes.
 * @returns {Uint8Array} The corresponding Uint8Array.
 */
export function bytesToUint8Array(bytes: number[]): Uint8Array {
  return Uint8Array.from(bytes);
}


/**
 * Converts a full 128-bit Bluetooth UUID string to its 16-bit short form if possible.
 * Standard Bluetooth Base UUID: 0000xxxx-0000-1000-8000-00805F9B34FB
 *
 * @param {string} uuid The full 128-bit UUID string.
 * @returns {string | null} The 16-bit short UUID (e.g., "xxxx") in uppercase, or null if it doesn't match the base UUID format.
 */
export const getShortUUID = (uuid: string): string | null => {
  if (typeof uuid !== 'string' || uuid.length !== 36) {
    return null; // Invalid format
  }
  const upperUuid = uuid.toUpperCase();
  const baseUuidSuffix = '-0000-1000-8000-00805F9B34FB';

  if (upperUuid.startsWith('0000') && upperUuid.endsWith(baseUuidSuffix)) {
    // Extract the 4 hex characters representing the short UUID
    return upperUuid.substring(4, 8);
  }

  return null; // Doesn't match the standard base UUID pattern
};
