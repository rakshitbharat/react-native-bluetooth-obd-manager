import React from 'react';
import { BluetoothProvider } from '../../src/context/BluetoothProvider';

export const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <BluetoothProvider>
            {children}
        </BluetoothProvider>
    );
};

test('test-utils placeholder test', () => {
  expect(true).toBe(true); // Placeholder test
});
