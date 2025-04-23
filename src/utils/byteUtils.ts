import type { ChunkedResponse } from '../types';
import { bytesToString } from './ecuUtils';

export function isChunkedResponse(value: unknown): value is ChunkedResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'chunks' in value &&
    Array.isArray((value as ChunkedResponse).chunks)
  );
}

export function concatenateChunks(chunkedResponse: ChunkedResponse): Uint8Array {
  // Calculate total length
  let totalLength = 0;
  chunkedResponse.chunks.forEach(chunk => {
    totalLength += chunk.length;
  });

  // Create final array
  const combinedArray = new Uint8Array(totalLength);
  let offset = 0;
  chunkedResponse.chunks.forEach(chunk => {
    combinedArray.set(chunk, offset);
    offset += chunk.length;
  });

  return combinedArray;
}

export function chunksToString(chunkedResponse: ChunkedResponse): string {
  const combined = concatenateChunks(chunkedResponse);
  return bytesToString(combined);
}
