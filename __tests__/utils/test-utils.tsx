import React from 'react';
import { BluetoothProvider } from '../../src/context/BluetoothProvider';

const TestWrapper = ({ children }: { children?: React.ReactNode }) => (
  <BluetoothProvider>{children}</BluetoothProvider>
);

export { TestWrapper };

test('test-utils placeholder test', () => {
  expect(true).toBe(true);
});
