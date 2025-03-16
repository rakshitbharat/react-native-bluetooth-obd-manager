// Configurable Constants
export const specialOperations_default_args = {
  loadClearFaultCode: false,
  vinCommandFired: false,
};
export const START_OBD_OPERATION = 'START_OBD_OPERATION';
export const END_OBD_OPERATION = 'END_OBD_OPERATION';
export const END_OBD_OPERATION_AND_FLUSH_APP = 'END_OBD_OPERATION_AND_FLUSH_APP';
import {log as logMain} from '@src/utils/logs';
const DISCONNECT_TIMEOUT = 500;
export const MONITORING_INTERVALS = {
  default: 300,
  initCommand: 300,
  initCommandProtocol: 300,
  onlyTroubleCodes: 300,
};

function _c_log_h(...optionalParams) {
  try {
    if (typeof optionalParams[0] === 'string') {
      optionalParams[0] = `[OBDMonitor] ${optionalParams[0]}`;
    }
    logMain('debug', ...optionalParams);
  } catch (error) {
    logMain('error', '[OBDMonitor] Logging error:', error);
  }
}

const log = (...args) => {
  if (typeof args[1] === 'string') {
    args[1] = `[OBDMonitor] ${args[1]}`;
  }
  logMain(...args);
};

import BleManagerWrapper from '@src/helper/BleManagerWrapper';
import {DeviceEventEmitter} from '@own-react-native';
import {stringToBytes} from 'convert-string';
import {Platform} from '@own-react-native';

// OBD2 ELM327 Protocol Constants
export const DEFAULT_SERVICE_UUID_SHORT = 'fff0';
export const DEFAULT_CHARACTERISTIC_UUID_SHORT = 'fff1';
export const DEFAULT_SERVICE_UUID =
  Platform.OS === 'android' ? 'fff0' : '0000fff0-0000-1000-8000-00805f9b34fb';
export const DEFAULT_CHARACTERISTIC_UUID =
  Platform.OS === 'android' ? 'fff1' : '0000fff1-0000-1000-8000-00805f9b34fb';
export const WRITE_CHARACTERISTIC =
  Platform.OS === 'android' ? 'fff2' : '0000fff2-0000-1000-8000-00805f9b34fb';

class OBDMonitor {
  macAddress;
  service;
  characteristic;
  writeCharacteristic;
  peripheralInfo;
  deviceDetails;
  intervalMs;
  at_command_array = [];
  obdCommands = [];
  obdCommandsArrayPlain = [];
  stop_que_command = false;
  que_of_command_running = false;
  should_requeue = false;
  last_fired_at_command_array = [];
  last_fired_at_command = null;
  init_at_commands_fired = false;
  complete_response_received = false;

  constructor(macAddress, intervalMs = '2000') {
    this.initProps(macAddress, intervalMs);
  }

  async initProps(macAddress = null, intervalMs = null) {
    _c_log_h('Setting up system. Please wait...', {
      newMacAddress: macAddress,
      currentMacAddress: this.macAddress,
    });

    if (macAddress) {
      this.macAddress = macAddress;
    }

    if (intervalMs) {
      this.intervalMs = intervalMs;
    }

    this.service = null;
    this.characteristic = null;
    this.writeCharacteristic = null;
    this.peripheralInfo = null;
    this.deviceDetails = null;

    this.at_command_array = [];
    this.obdCommands = [];
    this.obdCommandsArrayPlain = [];
    this.stop_que_command = false;
    this.que_of_command_running = false;
    this.should_requeue = false;
    this.last_fired_at_command_array = [];
    this.last_fired_at_command = null;
    this.init_at_commands_fired = false;
    this.complete_response_received = false;
  }

  async writeCommand(currentCommand, fireRaw = false) {
    if (!this.macAddress) {
      _c_log_h('Error: Device macAddress is null or empty');
      throw new Error('Device macAddress cannot be null or empty');
    }

    if (!this.service || !this.characteristic || !this.writeCharacteristic) {
      _c_log_h('BLE state is invalid, attempting to reconnect...', {
        macAddress: this.macAddress,
        service: !!this.service,
        characteristic: !!this.characteristic,
        writeCharacteristic: !!this.writeCharacteristic,
      });

      if (!this.macAddress) {
        this.resetBLEState();
        throw new Error('Cannot reconnect - macAddress is missing');
      }

      const connected = await this.connectToDevice();
      if (!connected) {
        this.resetBLEState();
        throw new Error('Failed to establish BLE connection');
      }
    }

    let command = currentCommand;
    if (!fireRaw) {
      command = stringToBytes(command + '\r');
    }

    const hasWritePermission =
      this.writeCharacteristic &&
      (this.writeCharacteristic.properties?.write === true ||
        this.writeCharacteristic.properties?.writeWithoutResponse === true ||
        this.writeCharacteristic.properties?.Write === 'Write' ||
        this.writeCharacteristic.properties?.WriteWithoutResponse ===
          'WriteWithoutResponse' ||
        (typeof this.writeCharacteristic.properties === 'object' &&
          Object.keys(this.writeCharacteristic.properties).some(key =>
            key.toLowerCase().includes('write'),
          )));

    if (!hasWritePermission) {
      _c_log_h('No write permission found for characteristic:', {
        uuid: this.writeCharacteristic?.characteristic,
        properties: this.writeCharacteristic?.properties,
      });
      this.resetBLEState();
      throw new Error('Write characteristic does not have write permission');
    }

    try {
      const shouldUseWriteWithoutResponse =
        this.writeCharacteristic.properties?.WriteWithoutResponse ===
          'WriteWithoutResponse' ||
        this.writeCharacteristic.properties?.writeWithoutResponse === true;

      if (shouldUseWriteWithoutResponse) {
        await BleManagerWrapper.writeWithoutResponse(
          this.macAddress,
          this.service.uuid,
          this.writeCharacteristic.characteristic,
          command,
        );
      } else {
        await BleManagerWrapper.write(
          this.macAddress,
          this.service.uuid,
          this.writeCharacteristic.characteristic,
          command,
        );
      }

      await Promise.race([
        new Promise(resolve => setTimeout(resolve, 5000)),
        this.waitForResponse(),
      ]);

      this.complete_response_received = false;
    } catch (error) {
      _c_log_h('Error during write command:', error);
      this.resetBLEState();
      throw error;
    }
  }

  async waitForResponse() {
    while (!this.complete_response_received) {
      await OBDMonitor.delay(50);
    }
  }

  async connectToDevice() {
    _c_log_h('Attempting to connect to device...');

    if (!this.macAddress) {
      _c_log_h('Error: Cannot connect - macAddress is missing');
      return false;
    }

    BleManagerWrapper.stopScan();
    let retries = 3;
    while (retries > 0 && !this.stop_que_command) {
      try {
        let isConnected = await BleManagerWrapper.isPeripheralConnected(
          this.macAddress,
          [],
        );

        if (!isConnected) {
          isConnected = await BleManagerWrapper.connect(this.macAddress);
          await OBDMonitor.delay(1000);
        }

        if (isConnected) {
          if (!this.peripheralInfo) {
            const serviceUUIDs =
              Platform.OS === 'ios'
                ? [DEFAULT_SERVICE_UUID_SHORT]
                : [DEFAULT_SERVICE_UUID, DEFAULT_SERVICE_UUID_SHORT];

            this.peripheralInfo = await BleManagerWrapper.retrieveServices(
              this.macAddress,
              serviceUUIDs,
            );
          }

          if (!this.service) {
            this.service = this.peripheralInfo.services.find(s => {
              const serviceUUID =
                Platform.OS === 'ios' ? s.uuid.toLowerCase() : s.uuid;
              return (
                serviceUUID === DEFAULT_SERVICE_UUID_SHORT ||
                serviceUUID === DEFAULT_SERVICE_UUID
              );
            });
          }

          if (this.service && !this.characteristic) {
            const relatedCharacteristics =
              this.peripheralInfo.characteristics.filter(
                ch => ch.service === this.service.uuid,
              );

            this.writeCharacteristic = this.findWriteCharacteristic(
              relatedCharacteristics,
            );

            if (
              !this.writeCharacteristic ||
              !this.validateWriteCharacteristic(this.writeCharacteristic)
            ) {
              this.resetBLEState();
              retries--;
              continue;
            }

            this.characteristic = relatedCharacteristics.find(ch => {
              const charUUID =
                Platform.OS === 'ios'
                  ? ch.characteristic.toLowerCase()
                  : ch.characteristic;
              return (
                charUUID === DEFAULT_CHARACTERISTIC_UUID_SHORT ||
                charUUID === DEFAULT_CHARACTERISTIC_UUID
              );
            });

            if (!this.characteristic) {
              this.characteristic = relatedCharacteristics.find(
                ch => ch.properties?.notify || ch.properties?.indicate,
              );
            }
          }

          if (this.peripheralInfo && this.characteristic && this.service) {
            await BleManagerWrapper.startNotification(
              this.macAddress,
              this.service.uuid,
              this.characteristic.characteristic,
            );
            return true;
          }
        }
        retries--;
      } catch (error) {
        retries--;
        _c_log_h('Error during connection:', error);
      }
    }
    return false;
  }

  async disconnectDevice() {
    _c_log_h('Disconnecting the device...');
    try {
      await this.writeCommand('ATZ');
      await BleManagerWrapper.stopScan();

      if (this.service && this.characteristic) {
        await BleManagerWrapper.stopNotification(
          this.macAddress,
          this.service.uuid,
          this.characteristic.characteristic,
        );
      }

      await OBDMonitor.delay(1000);
      await BleManagerWrapper.disconnect(this.macAddress);
      this.resetBLEState();
      await OBDMonitor.delay(DISCONNECT_TIMEOUT);
    } catch (error) {
      _c_log_h('Error during disconnection:', error);
      this.resetBLEState();
    }
  }

  resetBLEState() {
    _c_log_h('Resetting BLE state...');
    const tempMacAddress = this.macAddress;
    this.service = null;
    this.characteristic = null;
    this.writeCharacteristic = null;
    this.peripheralInfo = null;
    this.deviceDetails = null;
    this.complete_response_received = false;
    this.macAddress = tempMacAddress;
  }

  validateWriteCharacteristic(characteristic) {
    if (!characteristic) return false;

    const hasWritePermission =
      characteristic.properties?.write === true ||
      characteristic.properties?.writeWithoutResponse === true ||
      characteristic.properties?.Write === 'Write' ||
      characteristic.properties?.WriteWithoutResponse === 'WriteWithoutResponse' ||
      (typeof characteristic.properties === 'object' &&
        Object.keys(characteristic.properties).some(key =>
          key.toLowerCase().includes('write'),
        ));

    return hasWritePermission;
  }

  findWriteCharacteristic(relatedCharacteristics) {
    return relatedCharacteristics.find(ch => {
      const charUUID = (
        Platform.OS === 'ios'
          ? ch.characteristic.toLowerCase()
          : ch.characteristic
      ).replace(/[^a-f0-9]/gi, '');

      const targetShortUUID = 'fff2';
      const targetLongUUID = '0000fff2-0000-1000-8000-00805f9b34fb'.replace(
        /[^a-f0-9]/gi,
        '',
      );

      return (
        charUUID.endsWith(targetShortUUID) ||
        charUUID === targetLongUUID ||
        (ch.properties &&
          (ch.properties.write === true ||
            ch.properties.writeWithoutResponse === true ||
            ch.properties.Write === 'Write' ||
            ch.properties.WriteWithoutResponse === 'WriteWithoutResponse'))
      );
    });
  }

  static delay = ms => new Promise(resolve => setTimeout(resolve, ms));
}

export default OBDMonitor;
