// src/context/BluetoothContext.ts

import React, { createContext } from 'react';
/**
 * Context for accessing the Bluetooth state values.
 * Consumers should use `useContext(BluetoothStateContext)`.
 */
export const BluetoothStateContext = /*#__PURE__*/createContext(undefined);

/**
 * Context for accessing the dispatch function to update Bluetooth state.
 * Consumers should use `useContext(BluetoothDispatchContext)`.
 */
export const BluetoothDispatchContext = /*#__PURE__*/createContext(undefined);

// Optional: Provider names for React DevTools
BluetoothStateContext.displayName = 'BluetoothStateContext';
BluetoothDispatchContext.displayName = 'BluetoothDispatchContext';

/**
 * Hook to safely access the Bluetooth state context.
 * Throws an error if used outside of a BluetoothProvider.
 */
export function useBluetoothState() {
  const context = React.useContext(BluetoothStateContext);
  if (context === undefined) {
    throw new Error('useBluetoothState must be used within a BluetoothProvider');
  }
  return context;
}
;

/**
 * Hook to safely access the Bluetooth dispatch context.
 * Throws an error if used outside of a BluetoothProvider.
 */
export function useBluetoothDispatch() {
  const context = React.useContext(BluetoothDispatchContext);
  if (context === undefined) {
    throw new Error('useBluetoothDispatch must be used within a BluetoothProvider');
  }
  return context;
}
;
//# sourceMappingURL=BluetoothContext.js.map