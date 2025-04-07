# Bluetooth Response Chunking Issue

## Problem Description

When using `sendCommand` and `sendCommandRaw` functions, we've identified an issue with how Bluetooth responses are collected and returned. Currently, all incoming data chunks from `BleManagerDidUpdateValueForCharacteristic` are flattened into a single array, losing the chunk boundaries which can represent important protocol-specific separations like line breaks.

### Current Behavior
- Incoming data chunks: `[[69, 76, 77], [51, 50, 55], [32, 118, 49, 46, 53, 62]]`
- After flattening: `[69, 76, 77, 51, 50, 55, 32, 118, 49, 46, 53, 62]`
- `sendCommand` returns: `"ELM327 v1.5"` (losing potential line breaks)
- `sendCommandRaw` should return the array of chunks but returns a flattened array

## Technical Context

The ELM327 adapter can send responses in multiple chunks, each potentially containing semantically significant boundaries (like line breaks). These chunks arrive asynchronously through the `BleManagerDidUpdateValueForCharacteristic` event until we detect the ELM327 prompt byte (`>`, ASCII 62).
