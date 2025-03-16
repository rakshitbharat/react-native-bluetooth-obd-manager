declare module 'text-decoding' {
  export class TextDecoder {
    constructor(encoding?: string);
    decode(buffer: Uint8Array | number[]): string;
  }
}

declare module 'convert-string' {
  export function stringToBytes(str: string): number[];
  export function bytesToString(bytes: number[]): string;
  export default {
    stringToBytes,
    bytesToString,
  };
}
