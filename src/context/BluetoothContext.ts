// src/context/BluetoothContext.ts

import React, { createContext } from 'react';
import type { BluetoothState, BluetoothDispatch } from '../types';
import { initialState } from './BluetoothReducer';

// Context creation with proper typing and null safety
export const BluetoothStateContext = createContext<BluetoothState | null>(
  initialState,
);
export const BluetoothDispatchContext = createContext<BluetoothDispatch | null>(
  null,
);

// Set display names for React DevTools
BluetoothStateContext.displayName = 'BluetoothStateContext';
BluetoothDispatchContext.displayName = 'BluetoothDispatchContext';

/**
 * Hook to safely access the Bluetooth state context.
 * Throws an error if used outside of a BluetoothProvider or if state is null.
 */
export function useBluetoothState(): BluetoothState {
  const context = React.useContext(BluetoothStateContext);
  if (context === undefined || context === null) {
    throw new Error(
      'useBluetoothState must be used within a BluetoothProvider and state must be initialized',
    );
  }
  return context;
}

/**
 * Hook to safely access the Bluetooth dispatch context.
 * Throws an error if used outside of a BluetoothProvider or if dispatch is null.
 */
export function useBluetoothDispatch(): BluetoothDispatch {
  const context = React.useContext(BluetoothDispatchContext);
  if (context === undefined || context === null) {
    throw new Error(
      'useBluetoothDispatch must be used within a BluetoothProvider and dispatch must be initialized',
    );
  }
  return context;
}
