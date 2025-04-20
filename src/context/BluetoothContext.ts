// src/context/BluetoothContext.ts

import React, { createContext } from 'react';
import type { BluetoothState, BluetoothDispatch } from '../types';
import { initialState } from './BluetoothReducer';

// Context creation with proper typing
export const BluetoothStateContext =
  createContext<BluetoothState>(initialState);
export const BluetoothDispatchContext = createContext<BluetoothDispatch>(() => {
  console.warn('BluetoothDispatch was called before provider was ready');
});

// Set display names for React DevTools
BluetoothStateContext.displayName = 'BluetoothStateContext';
BluetoothDispatchContext.displayName = 'BluetoothDispatchContext';

/**
 * Hook to safely access the Bluetooth state context.
 * Throws an error if used outside of a BluetoothProvider.
 */
export function useBluetoothState(): BluetoothState {
  const context = React.useContext(BluetoothStateContext);
  if (context === undefined) {
    throw new Error(
      'useBluetoothState must be used within a BluetoothProvider',
    );
  }
  return context;
}

/**
 * Hook to safely access the Bluetooth dispatch context.
 * Throws an error if used outside of a BluetoothProvider.
 */
export function useBluetoothDispatch(): BluetoothDispatch {
  const context = React.useContext(BluetoothDispatchContext);
  if (context === undefined) {
    throw new Error(
      'useBluetoothDispatch must be used within a BluetoothProvider',
    );
  }
  return context;
}
