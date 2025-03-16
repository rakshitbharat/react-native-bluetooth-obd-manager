# React Native Bluetooth OBD Manager

## Project Overview
This project aims to simplify OBD-based project development by providing a ready-to-use package that handles initialization and common Bluetooth/OBD2 operations. This helps developers skip the complex setup and focus on business logic.

## Core Dependencies

### Core Libraries
- react-native (via @own-react-native alias)
- react-redux (state management)

### Bluetooth Libraries
- react-native-ble-manager
- react-native-permissions

### Utility Libraries
- convert-string
- text-decoding

### System Wrappers
- SystemSettingWrapper
- AlertWrapper

## Architecture Components

### BluetoothContext
- Wraps entire project runtime data
- Uses useReducer for state management
- Handles initialization checks
- Manages real-time states:
  - Bluetooth permission status
  - Bluetooth on/off status
  - Device connection status

### Bluetooth Notification System
- Handles raw byte data reception from Bluetooth devices
- Acts as a data receiver listener

### Bluetooth Scanner
- Implements stable device scanning
- Detects nearby Bluetooth devices

### Connection Management
- Stable connection handling for ELM327 devices
- Smart service and characteristic detection
- Supports multiple connection methods:
  - Write with response
  - Write without response
  - Auto-detection of best method

### Command Interface
- Supports string command sending (e.g., ATZ)
- Automatic byte conversion
- Dynamic selection of write methods
- Handles command responses using '>' delimiter
- Smart connection to any ELM327 dongle using MAC address

### Listener Management
- Global singleton listener setup
- Continuous notification monitoring
- No manual start/stop required during disconnects

### Streaming Control
- Command response tracking
- Automatic flag management for streaming status
- Timeout handling (4-second threshold)
- Sync monitoring and recovery

### Disconnection Handling
- Clean device disconnection
- Proper notification stopping
- State reset management

### Permission and Status Monitoring
- Bluetooth permission request handling
- Real-time connection status monitoring
- Automatic disconnection detection

## Usage
All operations are encapsulated in BluetoothContext and exposed via hooks for seamless integration.
