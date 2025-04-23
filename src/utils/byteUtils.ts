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
