# React Native Bluetooth OBD2 Manager

A simple reference implementation for communicating with OBD2 ELM327 devices over Bluetooth in React Native.

## Core Components

### Bluetooth Management
- `BluetoothContext.js` - Context provider for Bluetooth device state
- `BluetoothStateManagerWrapper.js` - Bluetooth state management utilities
- `useManageBluetooth.js` - Hook for Bluetooth device scanning and connection
- `useBluetooth.js` - Hook for Bluetooth permissions and state

### OBD2/ELM327 Communication
- `OBDMonitor.js` - Core OBD2 device communication
- `OBDUtils.js` - ELM327 protocol constants and configurations
- `BLEDataReceiver.js` - Bluetooth data reception and parsing
- `BleEmitterUtils.js` - Bluetooth data emission utilities

### Data Processing
- `utils.js` - Byte conversion and hex utilities for OBD2 data

## Standard PIDs
The following standard PIDs are supported:
- ENGINE_RPM (010C)
- VEHICLE_SPEED (010D)
- ENGINE_COOLANT_TEMP (0105)
- THROTTLE_POS (0111)
- INTAKE_MAP (010B)
- MAF_SENSOR (0110)
- O2_SENSORS (0113)
- OBD_STANDARDS (011C)
- VIN (0902)

## ELM327 Commands
Essential AT commands supported:
- ATZ (Reset)
- AT RV (Read Voltage)
- ATPC (Protocol Close)
- ATDPN (Get Protocol)
- ATSP0 (Auto Protocol)
- ATL0 (Linefeeds Off)
- ATS0 (Spaces Off)
- ATH0 (Headers Off)
- ATE0 (Echo Off)
- ATAT2 (Adaptive Timing)
