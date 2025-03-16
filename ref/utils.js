import {TextDecoder} from 'text-decoding';

/**
 * Convert hex string to byte array
 * @param {string} hex
 * @returns {number[]}
 */
export const hexToBytes = hex => {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
};

/**
 * Convert byte array to hex string
 * @param {number[]} bytes
 * @returns {string}
 */
export const bytesToHex = bytes => {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Get payload from buffer
 * @param {number[]} buffer
 * @returns {string}
 */
export const getPayLoad = buffer => {
  if (!buffer || buffer.length < 2) return '';
  return bytesToHex(buffer.slice(2));
};

/**
 * Decode value to string
 * @param {number[] | number} value
 * @returns {string}
 */
export const decodeValue = value => {
  if (!value) return '';
  const textDecoder = new TextDecoder('utf-8');
  try {
    return textDecoder.decode(new Uint8Array(value));
  } catch (error) {
    console.error('[ECUDecoder] Error decoding value:', error);
    return '';
  }
};

/**
 * Convert byte array to string
 * @param {number[] | number | string} bytes
 * @returns {string}
 */
export const byteArrayToString = bytes => {
  try {
    // Handle null/undefined/empty cases
    if (!bytes) return '';

    // If it's already a string, return as is
    if (typeof bytes === 'string') return bytes;

    // If it's a number, convert to single byte array
    if (typeof bytes === 'number') return decodeValue([bytes]);

    // If it's not an array at all, try to stringify
    if (!Array.isArray(bytes)) return String(bytes);

    // If empty array
    if (bytes.length === 0) return '';

    // Handle nested arrays of any depth
    const flatten = arr => {
      return arr.reduce((flat, item) => {
        return flat.concat(Array.isArray(item) ? flatten(item) : item);
      }, []);
    };

    // Flatten and decode
    const flattened = flatten(bytes);
    return decodeValue(flattened);
  } catch (error) {
    console.error('[ECUDecoder] Error in byteArrayToString:', error);
    return '';
  }
};

/**
 * Format number as hex string
 * @param {number} num
 * @param {number} width
 * @returns {string}
 */
export const toHexString = (num, width = 2) => {
  return num.toString(16).toUpperCase().padStart(width, '0');
};

/**
 * Validate hex string
 * @param {string} hex
 * @returns {boolean}
 */
export const isValidHex = hex => {
  return /^[0-9A-Fa-f]+$/.test(hex);
};

/**
 * Calculate checksum
 * @param {number[]} data
 * @returns {number}
 */
export const calculateChecksum = data => {
  return data.reduce((acc, val) => acc ^ val, 0);
};
