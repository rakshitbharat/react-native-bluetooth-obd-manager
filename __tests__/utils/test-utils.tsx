import React, { type FC, type ReactNode } from 'react';
import { BluetoothProvider } from '../../src/context/BluetoothProvider';

export const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
  <BluetoothProvider>{children}</BluetoothProvider>
);

test('test-utils placeholder test', () => {
  expect(true).toBe(true); // Placeholder test
});
