import { createContext } from 'react';

import { BluetoothContextValue } from '../types/bluetoothTypes';

// Create the Bluetooth context with a null default value
const BluetoothContext = createContext<BluetoothContextValue | null>(null);
BluetoothContext.displayName = 'BluetoothContext';

// Export just the context, all implementation is in BluetoothContext.tsx
export { BluetoothContext };
export default BluetoothContext;
