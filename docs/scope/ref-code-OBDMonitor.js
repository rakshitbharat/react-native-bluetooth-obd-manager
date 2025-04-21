// Configurable Constants
export const specialOperations_default_args = {
  loadClearFaultCode: false,
  vinCommandFired: false,
};
export const START_OBD_OPERATION = 'START_OBD_OPERATION';
export const END_OBD_OPERATION = 'END_OBD_OPERATION';
export const END_OBD_OPERATION_AND_FLUSH_APP =
  'END_OBD_OPERATION_AND_FLUSH_APP';
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
import store from '@src/store';
import {resetConnectionStore} from '@src/store';
import TaskQueueManager from '@src/helper/TaskQueueManager';
import {Platform} from '@own-react-native';
import obd from '@src/helper/core_libs/IOBD2/ReactOBD2JavaScript';
import {flushEverything} from './BLEDataReceiver';
import {flushEverything as flushElmProtocolHelper} from './ECUConnector/decoder/lib/ElmProtocolHelper';
import {flushEverything as flushProtocolServiceBased} from './ECUConnector/ProtocolServiceBased';
import BLEDataReceiver from './BLEDataReceiver';
export const DEFAULT_SERVICE_UUID_SHORT = 'fff0';
import BleEmitterUtils from '@src/helper/BleEmitterUtils';

export const DEFAULT_CHARACTERISTIC_UUID_SHORT = 'fff1';

export const DEFAULT_SERVICE_UUID =
  Platform.OS === 'android' ? 'fff0' : '0000fff0-0000-1000-8000-00805f9b34fb';

export const DEFAULT_CHARACTERISTIC_UUID =
  Platform.OS === 'android' ? 'fff1' : '0000fff1-0000-1000-8000-00805f9b34fb';

export const WRITE_CHARACTERISTIC =
  Platform.OS === 'android' ? 'fff2' : '0000fff2-0000-1000-8000-00805f9b34fb';

import {
  TroubleCodesCommand,
  SpeedCommand,
  RPMCommand,
  UTroubleCodesCommand,
  PTroubleCodesCommand,
  ClearFaultCodesCommand,
  VinCommand,
  ThrottlePositionCommand,
  EngineCoolantTemperatureCommand,
  MassAirFlowCommand,
  IntakeManifoldPressureCommand,
  AirIntakeTemperatureCommand,
  FuelPressureCommand,
  EGRCommandedCommand,
  EGRPositionErrorCommand,
  OxygenSensorCommand,
  CatConverterTempCommand,
  FuelTrimCommand,
  EngineFuelRateCommand,
  FuelRailPressureCommand,
} from './Commands';
import {setItem, removeItem} from '@src/store/storageSlice';

import ECUConnector from './ECUConnector';
import ECUDataRetriever from './ECUDataRetriever';
import {byteArrayToString} from './ECUConnector/decoder/lib/utils';

class OBDMonitor {
  macAddress;
  service;
  characteristic;
  writeCharacteristic;

  constructor(macAddress, intervalMs = '2000') {
    this.initProps(macAddress, intervalMs);
  }

  async checkSpecialOperations(specialOperations, onlyTroubleCodes) {
    const {loadClearFaultCode, vinCommandFired} = specialOperations;

    if (loadClearFaultCode === true) {
      onlyTroubleCodes = false;
    }

    if (vinCommandFired === true) {
      onlyTroubleCodes = false;
    }
    return onlyTroubleCodes;
  }

  async checkActiveOBDDevice() {
    if (this.get_currentActiveOBDDevice_status()) {
      _c_log_h('Another device is already active. Preparing for monitoring.');
    }
  }

  async performInitialSetup(macAddress) {
    _c_log_h('Starting the monitoring workflow...');
    const setupSuccessful = await this.initialSetup(macAddress);
    if (!setupSuccessful) {
      _c_log_h('Initial setup was unsuccessful after multiple attempts.');
      this.que_of_command_running = false;
      return false;
    }
    return true;
  }

  async prepareInitialCommands(onlyTroubleCodes) {
    _c_log_h('Preparing initial commands for device...');
    this.initialCommands = [];

    for (const cmd of this.initialCommands) {
      await this.queCommands(cmd);
    }
  }

  async prepareMonitoringCommands(
    onlyTroubleCodes,
    loadClearFaultCode = false,
    vinCommandFired = false,
  ) {
    if (onlyTroubleCodes) {
      _c_log_h('Monitoring for trouble codes...');
      await this.addCommand(new TroubleCodesCommand());
      // TODO: enable this after testing
      await this.addCommand(new UTroubleCodesCommand());
      await this.addCommand(new PTroubleCodesCommand());
    } else {
      if (loadClearFaultCode === true) {
        _c_log_h('Clear Fault Code vehicle parameters...');
        await this.addCommand(new ClearFaultCodesCommand());
      } else if (vinCommandFired === true) {
        _c_log_h('Monitoring VIN parameters...');
        await this.addCommand(new VinCommand());
      } else {
        _c_log_h('Monitoring vehicle parameters...');
        await this.addCommand(new SpeedCommand());
        await this.addCommand(new RPMCommand());
        await this.addCommand(new ThrottlePositionCommand());
        await this.addCommand(new EngineCoolantTemperatureCommand());
        await this.addCommand(new MassAirFlowCommand());
        await this.addCommand(new IntakeManifoldPressureCommand());
        await this.addCommand(new AirIntakeTemperatureCommand());
        await this.addCommand(new FuelPressureCommand());
        await this.addCommand(new EGRCommandedCommand());
        await this.addCommand(new EGRPositionErrorCommand());
        await this.addCommand(new OxygenSensorCommand());
        await this.addCommand(new CatConverterTempCommand());
        await this.addCommand(new FuelTrimCommand());
        await this.addCommand(new EngineFuelRateCommand());
        await this.addCommand(new FuelRailPressureCommand());
      }
    }
  }

  async executeMonitoringCommands(onlyTroubleCodes) {
    _c_log_h('Queuing OBD commands...');
    await this.queOBDCommands();
    _c_log_h('Executing OBD commands...');
    await this.executeCommands(onlyTroubleCodes);
    _c_log_h('exit');
  }

  // Main function
  async monitoringWorkflow(
    macAddress,
    onlyTroubleCodes = false,
    specialOperations = specialOperations_default_args,
  ) {
    onlyTroubleCodes = await this.checkSpecialOperations(
      specialOperations,
      onlyTroubleCodes,
    );

    await this.checkActiveOBDDevice();
    const setupSuccessful = await this.performInitialSetup(macAddress);
    if (!setupSuccessful) {
      return false;
    }
    await this.prepareInitialCommands(onlyTroubleCodes);
    await this.prepareMonitoringCommands(
      onlyTroubleCodes,
      specialOperations.loadClearFaultCode,
      specialOperations.vinCommandFired,
    );
    await this.executeMonitoringCommands(onlyTroubleCodes);
    store.dispatch(removeItem('obdDeviceCommunicationStatus'));
    store.dispatch(removeItem('obdDeviceStopppingOperation'));
  }

  async initProps(macAddress = null, intervalMs = null) {
    _c_log_h('Setting up system. Please wait...', {
      newMacAddress: macAddress,
      currentMacAddress: this.macAddress,
    });

    // Only update macAddress if a new one is provided
    if (macAddress) {
      this.macAddress = macAddress;
    }

    // Only update intervalMs if a new one is provided
    if (intervalMs) {
      this.intervalMs = intervalMs;
    }

    // Reset BLE-related properties except macAddress
    this.service = null;
    this.characteristic = null;
    this.writeCharacteristic = null;
    this.peripheralInfo = null;
    this.deviceDetails = null;

    // Reset command-related properties
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

    _c_log_h('System setup completed. Ready to start monitoring.', {
      preservedMacAddress: this.macAddress,
    });
  }

  async waitForLiveDataStatus() {
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 3000);

      DeviceEventEmitter.addListener('LiveDataStatus', status => {
        if (status === 'waiting_for_at_commands') {
          clearTimeout(timeout);
          resolve(true);
        }
      });
    });
  }

  async handleSkipInit(
    onlyTroubleCodes,
    specialOperations = specialOperations_default_args,
  ) {
    this.emptyATCommandArray();
    try {
      onlyTroubleCodes = await this.checkSpecialOperations(
        specialOperations,
        onlyTroubleCodes,
      );
      await this.prepareMonitoringCommands(
        onlyTroubleCodes,
        specialOperations.loadClearFaultCode,
        specialOperations.vinCommandFired,
      );
      _c_log_h('Because of Running Command, Queuing Latest OBD commands...');
      await this.queOBDCommands();
      DeviceEventEmitter.emit('init_data_changer_emitter', {
        key: 'obdCommandsArrayPlain',
        value: this.obdCommandsArrayPlain,
      });
      DeviceEventEmitter.emit('init_data_changer_emitter', {
        key: 'at_command_array',
        value: this.at_command_array,
      });
      return true;
    } catch (error) {
      _c_log_h('Error in HandleSkipInit:', error);
    }
    return false;
  }

  async emptyATCommandArray() {
    _c_log_h('Emptying AT Command');
    this.at_command_array = [];
    this.obdCommands = [];
    this.obdCommandsArrayPlain = [];
    DeviceEventEmitter.emit('init_data_changer_emitter', {
      key: 'at_command_array',
      value: this.at_command_array,
    });
    DeviceEventEmitter.emit('init_data_changer_emitter', {
      key: 'obdCommands',
      value: this.obdCommands,
    });
    DeviceEventEmitter.emit('init_data_changer_emitter', {
      key: 'obdCommandsArrayPlain',
      value: this.obdCommandsArrayPlain,
    });
  }

  async emit_init_data_changer_emitter(key, value) {
    this[key] = value;
    if (key === 'stop_que_command' && value === true) {
      this.at_command_array = [];
      DeviceEventEmitter.emit('init_data_changer_emitter', {
        key: 'at_command_array',
        value: this.at_command_array,
      });
    }
    this[key] = value;
    DeviceEventEmitter.emit('init_data_changer_emitter', {
      key: key,
      value: value,
    });
  }

  async interfereInRunningCommand(
    onlyTroubleCodes,
    specialOperations = specialOperations_default_args,
  ) {
    let detect_waiting = false;
    let _skip_init = this.get_obd_device_connected_status();
    if (_skip_init) {
      detect_waiting = await this.waitForLiveDataStatus();
    }
    if (_skip_init && detect_waiting) {
      try {
        _c_log_h('Returning back with interfer excution true...');
        return this.handleSkipInit(onlyTroubleCodes, specialOperations);
      } catch (error) {
        _c_log_h(
          'Either LiveDataStatus was not emitted or timeout occurred',
          error,
        );
      }
    }
    return false;
  }

  async startMonitoringBackGround(
    macAddress,
    onlyTroubleCodes,
    specialOperations = specialOperations_default_args,
  ) {
    this.initProps(macAddress, this.intervalMs);
    this.macAddress = macAddress;
    let interfere = await this.interfereInRunningCommand(
      onlyTroubleCodes,
      specialOperations,
    );
    if (interfere) {
      _c_log_h('Going Back from monitoring...');
      return;
    }
    TaskQueueManager.addTask(
      START_OBD_OPERATION,
      this.task_START_OBD_OPERATION.bind(
        this,
        macAddress,
        onlyTroubleCodes,
        specialOperations,
      ),
    );
  }

  async task_END_OBD_OPERATION_AND_FLUSH_APP() {
    _c_log_h(`Task timeout. Ending task ${END_OBD_OPERATION_AND_FLUSH_APP}.`);
    store.dispatch(removeItem('obdDeviceStopppingOperation'));
    await this.disconnectDevice();
    DeviceEventEmitter.emit('restart_app');
  }

  async task_END_OBD_OPERATION() {
    store.dispatch(removeItem('obdDeviceStopppingOperation'));
  }

  async task_START_OBD_OPERATION(
    macAddress,
    onlyTroubleCodes,
    specialOperations,
  ) {
    _c_log_h(macAddress, onlyTroubleCodes, specialOperations);
    let subscription = null;
    if (subscription !== undefined && subscription) {
      subscription.remove();
    }
    try {
      subscription = DeviceEventEmitter.addListener(
        'init_data_changer_emitter',
        data => {
          this[data.key] = data.value;
          if (data.key === 'stop_que_command' && data.value === true) {
            this.at_command_array = [];
          }
        },
      );
    } catch (error) {
      _c_log_h('Oops! Cant change the task params.');
    }
    if (await this.connectToDevice()) {
      await this.monitoringWorkflow(
        macAddress,
        onlyTroubleCodes,
        specialOperations,
      );
    }
    DeviceEventEmitter.emit('LiveDataStatus', 'ended');
  }

  async stopMonitoringBackGround() {
    TaskQueueManager.addTask(
      END_OBD_OPERATION,
      this.task_END_OBD_OPERATION.bind(this),
    );
    DeviceEventEmitter.emit('init_data_changer_emitter', {
      key: 'stop_que_command',
      value: true,
    });
    resetConnectionStore();
    TaskQueueManager.stopTask(START_OBD_OPERATION);
  }

  async executeCommands() {
    const ecuConnector = ECUConnector.getInstance(this);
    let ecu_connected;
    let connection_attempt_in_progress = false;

    while (
      !this.stop_que_command &&
      !(ecu_connected === true || ecu_connected === false)
    ) {
      if (!connection_attempt_in_progress) {
        connection_attempt_in_progress = true;
        ecu_connected = await ecuConnector.connectToECU();
        connection_attempt_in_progress = false;
        log('info', 'ecu_connected', ecu_connected, this.stop_que_command);
        if (ecu_connected === false) {
          this.stop_que_command = true;
          await OBDMonitor.delay(100);
          throw new Error('ECU connection failed');
        }
      } else {
        await OBDMonitor.delay(100); // Wait briefly if connection attempt is in progress
      }

      if (this.stop_que_command) {
        break;
      }
    }

    const ecuDataRetriever = ECUDataRetriever.getInstance(this);

    while (!this.stop_que_command && ecu_connected) {
      if (ecu_connected) {
        if (this.at_command_array.length > 0) {
          await ecuDataRetriever.retrieveAllData(this.at_command_array);
          DeviceEventEmitter.emit('LiveDataStatus', 'command_fired');
        } else {
          DeviceEventEmitter.emit('LiveDataStatus', 'waiting_for_at_commands');
          await OBDMonitor.delay(1000);
        }
      } else {
        this.stop_que_command = true;
        this.at_command_array = [];
        await OBDMonitor.delay(100);
      }
    }

    _c_log_h('Command execution has been stopped.');
  }

  // Reset BLE-related state
  resetBLEState() {
    _c_log_h('Resetting BLE state...', {
      currentMacAddress: this.macAddress,
    });
    // Store macAddress temporarily
    const tempMacAddress = this.macAddress;

    // Reset all BLE-related properties
    this.service = null;
    this.characteristic = null;
    this.writeCharacteristic = null;
    this.peripheralInfo = null;
    this.deviceDetails = null;
    this.complete_response_received = false;

    // Restore macAddress
    this.macAddress = tempMacAddress;

    _c_log_h('BLE state reset complete', {
      preservedMacAddress: this.macAddress,
    });
  }

  /**
   * Writes a command to the OBD device and waits for response
   * Will exit after either receiving complete response or after 2 seconds timeout
   * Note: complete_response_received flag is set to true in BLEDataReceiver.handleCompleteResponse
   * when a complete response (ending with '>') is received from the device
   */
  async writeCommand(
    currentCommand,
    fireRaw = false,
    forceFireCommand = false,
  ) {
    if (BLEDataReceiver.isTelegramWorkActive && forceFireCommand === false) {
      _c_log_h('info', 'Telegram work is active');
      return;
    }

    // Validate macAddress first
    if (!this.macAddress) {
      _c_log_h('Error: Device macAddress is null or empty');
      throw new Error('Device macAddress cannot be null or empty');
    }

    // Check BLE state before proceeding
    if (!this.service || !this.characteristic || !this.writeCharacteristic) {
      _c_log_h('BLE state is invalid, attempting to reconnect...', {
        macAddress: this.macAddress,
        service: !!this.service,
        characteristic: !!this.characteristic,
        writeCharacteristic: !!this.writeCharacteristic,
      });

      // Ensure we have macAddress before attempting reconnection
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
    let forCommandLastFiredCommand =
      typeof currentCommand === 'string'
        ? currentCommand
        : byteArrayToString(currentCommand);
    if (!fireRaw) {
      command = stringToBytes(command + '\r');
    }

    // Enhance write permission check in writeCommand method
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
      // Check for string-based WriteWithoutResponse property
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
        this.last_fired_at_command = forCommandLastFiredCommand;
        DeviceEventEmitter.emit('LiveDataStatus', 'command_fired');
      } else {
        await BleManagerWrapper.write(
          this.macAddress,
          this.service.uuid,
          this.writeCharacteristic.characteristic,
          command,
        );
        this.last_fired_at_command = forCommandLastFiredCommand;
        DeviceEventEmitter.emit('LiveDataStatus', 'command_fired');
      }

      // Wait for either complete response or timeout
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, 5000)), // 5 second timeout
        this.waitForResponse(), // wait for response
      ]);

      // Reset flag for next command
      this.complete_response_received = false;
    } catch (error) {
      _c_log_h('Error during write command:', error);
      this.resetBLEState();
      BleEmitterUtils.emitCommandFailure(error, {
        command: forCommandLastFiredCommand,
        macAddress: this.macAddress,
        characteristic: this.writeCharacteristic?.characteristic,
      });
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * Helper method that waits until complete_response_received becomes true
   * This flag will be set to true by notification handler when full response is received
   */
  async waitForResponse() {
    while (!this.complete_response_received) {
      await OBDMonitor.delay(50);
    }
  }

  async initialSetup() {
    _c_log_h('Starting initial setup...');
    let isConnected = await BleManagerWrapper.isPeripheralConnected(
      this.macAddress,
      [],
    );
    try {
      if (isConnected) {
        _c_log_h('Updating device status...');
        store.dispatch(
          setItem({
            key: 'obdDeviceCommunicationStatus',
            value: true,
          }),
        );
        _c_log_h('Initial setup completed successfully.');
        return true;
      }
    } catch (error) {
      _c_log_h('Initial setup encountered an error:', error);
    }
    return false;
  }

  async stopMonitoring() {
    _c_log_h('stopMonitoring');
    await this.stopMonitoringBackGround();
  }

  async stopMonitoringAndFlushApp() {
    _c_log_h('stopMonitoringAndFlushApp');
    TaskQueueManager.addTask(
      END_OBD_OPERATION_AND_FLUSH_APP,
      this.task_END_OBD_OPERATION_AND_FLUSH_APP.bind(this),
    );
    DeviceEventEmitter.emit('init_data_changer_emitter', {
      key: 'stop_que_command',
      value: true,
    });
    TaskQueueManager.stopTask(END_OBD_OPERATION_AND_FLUSH_APP);
  }

  async queOBDCommands() {
    _c_log_h('Queuing up OBD commands...');
    if (this.obdCommands.length === 0) {
      _c_log_h('No commands in the queue.');
      return;
    }
    this.obdCommandsArrayPlain = [];
    try {
      for (const command of this.obdCommands) {
        if (command.getATCommand) {
          await this.queCommands(command.getATCommand());
          this.obdCommandsArrayPlain.push(command.getATCommand());
        }
      }
    } catch (error) {
      _c_log_h('Error while queuing OBD commands:', error);
    }
  }

  async connectToDevice() {
    _c_log_h('Attempting to connect to device...');

    // Validate macAddress first
    if (!this.macAddress) {
      _c_log_h('Error: Cannot connect - macAddress is missing');
      return false;
    }

    BleManagerWrapper.stopScan();
    let retries = 3;
    while (retries > 0 && !this.stop_que_command) {
      try {
        _c_log_h('Checking if peripheral is connected...', {
          macAddress: this.macAddress,
        });
        let isConnected = await BleManagerWrapper.isPeripheralConnected(
          this.macAddress,
          [],
        );
        _c_log_h('isPeripheralConnected result:', isConnected);

        if (!isConnected) {
          _c_log_h('Attempting to connect to peripheral...', {
            macAddress: this.macAddress,
          });
          isConnected = await BleManagerWrapper.connect(this.macAddress);
          _c_log_h('Connect result:', isConnected);
          _c_log_h('Waiting after connection...');
          await OBDMonitor.delay(1000);
        }

        if (isConnected) {
          _c_log_h('Device connected, checking peripheralInfo...');
          if (!this.peripheralInfo) {
            const serviceUUIDs =
              Platform.OS === 'ios'
                ? [DEFAULT_SERVICE_UUID_SHORT]
                : [DEFAULT_SERVICE_UUID, DEFAULT_SERVICE_UUID_SHORT];

            _c_log_h('Retrieving services with UUIDs:', serviceUUIDs);
            this.peripheralInfo = await BleManagerWrapper.retrieveServices(
              this.macAddress,
              serviceUUIDs,
            );
            _c_log_h('Retrieved peripheral info:', {
              services: this.peripheralInfo?.services?.map(s => ({
                uuid: s.uuid,
                characteristics: s.characteristics,
              })),
              characteristics: this.peripheralInfo?.characteristics?.map(c => ({
                uuid: c.characteristic,
                service: c.service,
                properties: c.properties,
              })),
            });
          }

          _c_log_h('Checking for service...');
          if (!this.service) {
            if (!this.peripheralInfo?.services) {
              _c_log_h('No services found in peripheral info');
              retries--;
              continue;
            }

            _c_log_h(
              'Available services:',
              this.peripheralInfo.services.map(s => ({
                uuid: s.uuid,
                isPrimary: s.isPrimary,
              })),
            );

            this.service = this.peripheralInfo.services.find(s => {
              const serviceUUID =
                Platform.OS === 'ios' ? s.uuid.toLowerCase() : s.uuid;
              const result =
                serviceUUID === DEFAULT_SERVICE_UUID_SHORT ||
                serviceUUID === DEFAULT_SERVICE_UUID;
              _c_log_h('Comparing service UUID:', {
                found: serviceUUID,
                target1: DEFAULT_SERVICE_UUID_SHORT,
                target2: DEFAULT_SERVICE_UUID,
                matches: result,
              });
              return result;
            });

            if (!this.service) {
              _c_log_h('Service not found, retrying...');
              retries--;
              continue;
            }
          }

          _c_log_h('Service found, checking characteristics...');
          if (this.service && !this.characteristic) {
            if (!this.peripheralInfo?.characteristics) {
              _c_log_h('No characteristics found in peripheral info');
              retries--;
              continue;
            }

            const relatedCharacteristics =
              this.peripheralInfo.characteristics.filter(ch => {
                const matches = ch.service === this.service.uuid;
                _c_log_h('Filtering characteristic:', {
                  charService: ch.service,
                  targetService: this.service.uuid,
                  matches,
                });
                return matches;
              });

            _c_log_h(
              'Found related characteristics:',
              relatedCharacteristics.map(c => ({
                uuid: c.characteristic,
                service: c.service,
                properties: c.properties,
              })),
            );

            // Find and validate write characteristic
            this.writeCharacteristic = this.findWriteCharacteristic(
              relatedCharacteristics,
            );

            if (
              !this.writeCharacteristic ||
              !this.validateWriteCharacteristic(this.writeCharacteristic)
            ) {
              _c_log_h(
                'Write characteristic not found or no permissions, retrying...',
              );
              this.resetBLEState();
              retries--;
              continue;
            }

            // Then find the notification characteristic
            this.characteristic = relatedCharacteristics.find(ch => {
              const charUUID =
                Platform.OS === 'ios'
                  ? ch.characteristic.toLowerCase()
                  : ch.characteristic;
              const targetNotifyUUID =
                Platform.OS === 'ios'
                  ? DEFAULT_CHARACTERISTIC_UUID_SHORT.toLowerCase()
                  : DEFAULT_CHARACTERISTIC_UUID_SHORT;

              _c_log_h('Comparing notification characteristic:', {
                found: charUUID,
                target: targetNotifyUUID,
                properties: ch.properties,
              });

              return (
                charUUID === targetNotifyUUID ||
                charUUID === DEFAULT_CHARACTERISTIC_UUID
              );
            });

            if (!this.characteristic) {
              // Fallback: Try to find any characteristic with notify permission
              this.characteristic = relatedCharacteristics.find(
                ch => ch.properties?.notify || ch.properties?.indicate,
              );

              if (this.characteristic) {
                _c_log_h('Found alternative notification characteristic:', {
                  uuid: this.characteristic.characteristic,
                  properties: this.characteristic.properties,
                });
              } else {
                _c_log_h(
                  'No notification characteristic found. Available characteristics:',
                  relatedCharacteristics.map(c => ({
                    uuid: c.characteristic,
                    properties: c.properties,
                  })),
                );
              }
            } else {
              _c_log_h('Found primary notification characteristic:', {
                uuid: this.characteristic.characteristic,
                properties: this.characteristic.properties,
              });
            }
          }
          this.deviceDetails = this.prepareDeviceDetails();
          if (this.peripheralInfo && this.characteristic && this.service) {
            _c_log_h('Enabling notifications...', {
              deviceDetails: this.deviceDetails,
            });
            await Promise.race([
              BleManagerWrapper.startNotification(
                this.macAddress,
                this.service.uuid,
                this.characteristic.characteristic,
              ),
              OBDMonitor.delay(2000),
            ]);
            _c_log_h('Connected and initialized.');
            retries = 0;
            return true;
          } else {
            _c_log_h('Failed to initialize all required components');
            retries--;
          }
        }
      } catch (error) {
        retries--;
        if (retries > 0) {
          _c_log_h(`Retrying setup. You have ${retries} attempts left.`);
        }
        _c_log_h('Error during connection:', error);
      }
    }
    _c_log_h('Error during connection. Retries exhausted.');
    return false;
  }

  async disconnectDevice(_DISCONNECT_TIMEOUT = DISCONNECT_TIMEOUT) {
    _c_log_h('Disconnecting the device...');
    try {
      await this.writeCommand('ATZ');
      // First stop all ongoing BLE operations
      await BleManagerWrapper.stopScan();
      await BleManagerWrapper.stopAll();

      // Stop notifications if they were started
      if (this.service && this.characteristic) {
        try {
          _c_log_h('Stopping notifications...');
          await BleManagerWrapper.stopNotification(
            this.macAddress,
            this.service.uuid,
            this.characteristic.characteristic,
          );
        } catch (error) {
          _c_log_h('Error stopping notifications:', error);
        }
      }

      // Wait a bit for operations to clean up
      await OBDMonitor.delay(1000);

      // Then disconnect from device
      await BleManagerWrapper.disconnect(this.macAddress);

      // Clear connection state from store
      store.dispatch(removeItem('obdDeviceCommunicationStatus'));
      store.dispatch(removeItem('protocolForPendingOBDDeviceForOnBoarding'));

      _c_log_h(`Successfully disconnected from ${this.macAddress}.`);

      // Reset BLE state
      this.resetBLEState();

      // Reset command-related state
      this.que_of_command_running = false;
      this.stop_que_command = true;
      this.init_at_commands_fired = false;
      this.last_fired_at_command = null;
      this.last_fired_at_command_array = [];
      this.at_command_array = [];
      this.obdCommands = [];
      this.obdCommandsArrayPlain = [];

      // Flush related systems
      flushEverything();
      flushElmProtocolHelper();
      obd.flushInstance();
      flushProtocolServiceBased();

      // Add a delay before allowing reconnection
      await OBDMonitor.delay(_DISCONNECT_TIMEOUT);
      await this.initProps();
    } catch (error) {
      _c_log_h('Error during disconnection:', error);
      // Even if disconnect fails, still clean up local state
      this.resetBLEState();
      await this.initProps();
      flushEverything();
      flushElmProtocolHelper();
      obd.flushInstance();
      flushProtocolServiceBased();
    }
  }

  async queCommands(at_command) {
    try {
      this.at_command_array.push(at_command);
    } catch (error) {
      _c_log_h(`Couldn't queue command ${at_command}.`, error);
    }
  }

  get_defaultProtocol(onlyKey = false) {
    try {
      let protocol = this.get_defaultProtocol_key();
      if (onlyKey) {
        return protocol;
      }
      // this is special command in which our detection gets auto detected inside device
      if (protocol === 'D') {
        return 'ATD';
      }
      return protocol ? `ATSP${protocol}` : 'ATSP0';
    } catch (error) {
      _c_log_h('Error in fetching default protocol:', error);
      if (onlyKey) {
        return '0';
      }
      return 'ATSP0';
    }
  }

  get_defaultProtocol_key() {
    try {
      let protocol =
        store.getState()?.storage?.data?.currentActiveOBDDevice?.protocol ||
        store.getState()?.storage?.data
          ?.protocolForPendingOBDDeviceForOnBoarding;
      return protocol ? protocol : '0';
    } catch (error) {
      return '0';
    }
  }

  get_obdDeviceCommunicationStatus() {
    try {
      let r = store.getState()?.storage?.data?.obdDeviceCommunicationStatus;
      return r ? r : false;
    } catch (error) {
      return false;
    }
  }

  get_protocolForPendingOBDDeviceForOnBoarding() {
    try {
      let protocol =
        store.getState()?.storage?.data
          ?.protocolForPendingOBDDeviceForOnBoarding;
      return this.check_detected_protocol(protocol) ? protocol : null;
    } catch (error) {}
    return null;
  }

  set_protocolForPendingOBDDeviceForOnBoarding(
    full_at_command_protocol = 'ATSP0',
  ) {
    const lastCharacter = full_at_command_protocol.charAt(
      full_at_command_protocol.length - 1,
    );
    store.dispatch(
      setItem({
        key: 'protocolForPendingOBDDeviceForOnBoarding',
        value: lastCharacter,
      }),
    );
  }

  check_detected_protocol(p) {
    if (typeof p == 'string' && p.length > 0) {
      return true;
    }
    return false;
  }

  get_detected_protocol() {
    try {
      let c = store.getState()?.obdLiveData.SupportedPIDs.chanceCategory;
      let p = store.getState()?.obdLiveData.SupportedPIDs.protocolUsed;
      if (c && (p == '0' || p) && c === 'high') {
        return p;
      }
    } catch (error) {}
    return null;
  }

  get_currentActiveOBDDevice_status() {
    try {
      if (
        store.getState()?.storage?.data?.currentActiveOBDDevice?.id !==
        undefined
      ) {
        return true;
      }
    } catch (error) {
      return null;
    }
  }

  get_currentActiveOBDDevice_protocol() {
    try {
      if (
        store.getState()?.storage?.data?.currentActiveOBDDevice?.protocol !==
        undefined
      ) {
        return store.getState()?.storage?.data?.currentActiveOBDDevice
          ?.protocol;
      }
    } catch (error) {
      return null;
    }
  }

  get_obd_device_connected_status() {
    try {
      if (
        this.get_currentActiveOBDDevice_status() &&
        this.get_currentActiveOBDDevice_protocol()
      ) {
        return true;
      }
    } catch (error) {}
    return false;
  }

  async addCommand(command) {
    try {
      this.obdCommands.push(command);
    } catch (error) {
      _c_log_h(`Failed to add command to the queue.`, error);
    }
  }

  prepareDeviceDetails() {
    return {
      macAddress: this.macAddress,
      service: this.service,
      characteristic: this.characteristic,
    };
  }

  static delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  validateWriteCharacteristic(characteristic) {
    if (!characteristic) return false;

    const hasWritePermission =
      characteristic.properties?.write === true ||
      characteristic.properties?.writeWithoutResponse === true ||
      characteristic.properties?.Write === 'Write' ||
      characteristic.properties?.WriteWithoutResponse ===
        'WriteWithoutResponse' ||
      (typeof characteristic.properties === 'object' &&
        Object.keys(characteristic.properties).some(key =>
          key.toLowerCase().includes('write'),
        ));

    if (!hasWritePermission) {
      _c_log_h('No write permission found for characteristic:', {
        uuid: characteristic?.characteristic,
        properties: characteristic?.properties,
      });
      return false;
    }

    _c_log_h('Found write characteristic with permissions:', {
      uuid: characteristic.characteristic,
      properties: characteristic.properties,
    });
    return true;
  }

  findWriteCharacteristic(relatedCharacteristics) {
    return relatedCharacteristics.find(ch => {
      const charUUID = (
        Platform.OS === 'ios'
          ? ch.characteristic.toLowerCase()
          : ch.characteristic
      ).replace(/[^a-f0-9]/gi, '');

      // Handle both short and long UUID formats
      const targetShortUUID = 'fff2';
      const targetLongUUID = '0000fff2-0000-1000-8000-00805f9b34fb'.replace(
        /[^a-f0-9]/gi,
        '',
      );

      _c_log_h('Comparing write characteristic:', {
        found: charUUID,
        targetShort: targetShortUUID,
        targetLong: targetLongUUID,
        properties: ch.properties,
      });

      // Match either the short or long format
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
}

export default OBDMonitor;
