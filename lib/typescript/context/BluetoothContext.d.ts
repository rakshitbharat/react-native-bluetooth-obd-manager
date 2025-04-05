import React from 'react';
import type { BluetoothState, BluetoothDispatch } from '../types';
/**
 * Context for accessing the Bluetooth state values.
 * Consumers should use `useContext(BluetoothStateContext)`.
 */
export declare const BluetoothStateContext: React.Context<BluetoothState | undefined>;
/**
 * Context for accessing the dispatch function to update Bluetooth state.
 * Consumers should use `useContext(BluetoothDispatchContext)`.
 */
export declare const BluetoothDispatchContext: React.Context<BluetoothDispatch | undefined>;
/**
 * Hook to safely access the Bluetooth state context.
 * Throws an error if used outside of a BluetoothProvider.
 */
export declare function useBluetoothState(): BluetoothState;
/**
 * Hook to safely access the Bluetooth dispatch context.
 * Throws an error if used outside of a BluetoothProvider.
 */
export declare function useBluetoothDispatch(): BluetoothDispatch;
//# sourceMappingURL=BluetoothContext.d.ts.map