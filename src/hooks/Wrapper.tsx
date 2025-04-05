import React, { type FC, type ReactNode } from 'react';
import { BluetoothProvider } from '../context/BluetoothProvider';

const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
  <BluetoothProvider>{children}</BluetoothProvider>
);

export default Wrapper;
