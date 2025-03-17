import { it, describe, expect } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import React from 'react';

import { BluetoothProvider, useBluetooth } from '../context/BluetoothContext';

// Create a wrapper provider for testing
const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BluetoothProvider>{children}</BluetoothProvider>
);

describe('BluetoothContext', () => {
  it('should initialize correctly', async () => {
    const { result } = renderHook(() => useBluetooth(), { wrapper });
    expect(result.current).toBeDefined();
  });
});
