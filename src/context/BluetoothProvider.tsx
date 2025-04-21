// src/context/BluetoothProvider.tsx
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  FC,
  ErrorInfo,
  Component,
} from 'react';
import {
  NativeEventEmitter,
  NativeModules,
  View,
  Text,
  type EmitterSubscription,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import type {
  Peripheral,
  BleManagerState,
  BleManagerDidUpdateValueForCharacteristicEvent,
  ChunkedResponse,
} from '../types';
import {
  BluetoothDispatchContext,
  BluetoothStateContext,
} from './BluetoothContext';
import { bluetoothReducer, initialState } from './BluetoothReducer';
import type { PeripheralWithPrediction, DeferredPromise } from '../types';
import { ELM327_PROMPT_BYTE, CommandReturnType } from '../constants';
import { bytesToString } from '../utils/ecuUtils';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

/**
 * Represents the state of a command being executed over Bluetooth.
 * This interface tracks the promise, timeout, and response data for each command.
 */
interface CommandExecutionState {
  /** Promise that will resolve with the command's response */
  promise: DeferredPromise<string | Uint8Array | ChunkedResponse>;
  /** Timeout ID for command expiration */
  timeoutId: NodeJS.Timeout | null;
  /** Buffer storing incoming response bytes */
  responseBuffer: number[];
  /** Array storing each chunk of response data as it arrives */
  responseChunks: number[][];
  /** Expected format of the command's response */
  expectedReturnType: 'string' | 'bytes' | 'chunked';
}

/**
 * Props for the BluetoothProvider component
 */
interface BluetoothProviderProps {
  /** Child components that will have access to Bluetooth context */
  children: React.ReactNode;
}

/**
 * Context for internal command control state.
 * This context is used to manage command execution state across the provider.
 */
const InternalCommandControlContext = createContext<
  | {
      /** Reference to the currently executing command */
      currentCommandRef: React.MutableRefObject<CommandExecutionState | null>;
    }
  | undefined
>(undefined);

// Set a display name for easier debugging
InternalCommandControlContext.displayName = 'InternalCommandControlContext';

/**
 * Interface for Error Boundary props
 */
interface ErrorBoundaryProps {
  /** Child components to be rendered */
  children: React.ReactNode;
  /** Optional fallback UI to render when an error occurs */
  fallback?: React.ReactNode;
  /** Optional callback for handling errors */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional maximum number of retries before giving up */
  maxRetries?: number;
}

/**
 * Interface for Error Boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * Error Boundary component that catches and handles React errors
 * Provides error recovery, logging, and retry mechanisms
 */
class BluetoothErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
    };
  }

  static defaultProps = {
    maxRetries: 3,
    fallback: null,
    onError: (error: Error) => {
      console.error('[BluetoothErrorBoundary]', error);
    },
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to error reporting service
    this.props.onError?.(error, errorInfo);
  }

  private resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
    });
  };

  private retry = (): void => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState(prev => ({
        hasError: false,
        error: null,
        retryCount: prev.retryCount + 1,
      }));
    }
  };

  render(): React.ReactNode {
    const { hasError, retryCount } = this.state;
    const { children, fallback, maxRetries = 3 } = this.props;

    if (hasError) {
      if (retryCount < maxRetries) {
        // Attempt recovery by retrying
        this.retry();
        return null;
      }

      // If we've exceeded retries, show fallback or null
      return fallback || null;
    }

    return children;
  }
}

// Export for internal use
export { BluetoothErrorBoundary };

export const BluetoothProvider: FC<BluetoothProviderProps> = ({ children }) => {
  // Validate React environment inside the component
  if (!React) {
    throw new Error(
      'React is not available in the runtime environment. This usually indicates a dependency resolution issue.',
    );
  }

  // Initialize reducer with error handling
  const [state, dispatch] = useReducer(bluetoothReducer, initialState);
  const currentCommandRef = useRef<CommandExecutionState | null>(null);
  const isInitialized = useRef(false);

  const handleBoundaryError = useCallback(
    (error: Error, errorInfo: ErrorInfo) => {
      console.error('[BluetoothProvider] Error caught by boundary:', {
        error,
        errorInfo,
        deviceId: state.connectedDevice?.id,
        isConnecting: state.isConnecting,
        isScanning: state.isScanning,
      });

      // Attempt recovery by resetting relevant state
      dispatch({ type: 'SET_ERROR', payload: error });

      if (state.isConnecting || state.connectedDevice) {
        dispatch({ type: 'DEVICE_DISCONNECTED' });
      }

      if (state.isScanning) {
        dispatch({ type: 'SCAN_STOP' });
      }
    },
    [state.connectedDevice?.id, state.isConnecting, state.isScanning],
  );

  const fallbackUI = useMemo(
    () => (
      <View
        style={{
          padding: 20,
          backgroundColor: '#FEE2E2',
          borderRadius: 8,
          margin: 10,
        }}
      >
        <Text
          style={{
            color: '#991B1B',
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 8,
          }}
        >
          Bluetooth Connection Error
        </Text>
        <Text
          style={{
            color: '#7F1D1D',
            fontSize: 14,
          }}
        >
          There was a problem with the Bluetooth connection. The app will
          automatically try to recover.
        </Text>
      </View>
    ),
    [],
  );

  // Ensure state is never null during initialization
  useEffect(() => {
    if (!isInitialized.current) {
      dispatch({ type: 'SET_INITIALIZING', payload: true });
      isInitialized.current = true;
    }
  }, []);

  /**
   * Handles incoming data from BLE characteristic notifications.
   * Processes response chunks and resolves command promises when complete.
   *
   * @param dataValue - Array of bytes received from the BLE device
   */
  const handleIncomingData = useCallback(
    (dataValue: number[]) => {
      console.info('[BluetoothProvider] Received raw data:', 
        JSON.stringify(dataValue),
        'ASCII:', bytesToString(dataValue)
      );

      if (state.isAwaitingResponse && currentCommandRef.current) {
        try {
          const commandState = currentCommandRef.current;
          
          // Log buffer state before adding new data
          console.info('[BluetoothProvider] Current buffer before:', 
            bytesToString(commandState.responseBuffer)
          );
          
          commandState.responseChunks.push([...dataValue]);
          commandState.responseBuffer.push(...dataValue);

          // Log buffer state after adding new data
          console.info('[BluetoothProvider] Current buffer after:', 
            bytesToString(commandState.responseBuffer),
            'Raw:', JSON.stringify(commandState.responseBuffer)
          );

          // Check for prompt anywhere in the buffer
          const promptIndex = commandState.responseBuffer.indexOf(ELM327_PROMPT_BYTE);
          if (promptIndex !== -1) {
            console.info('[BluetoothProvider] Found prompt at index:', promptIndex);
            
            const responseBytes = commandState.responseBuffer.slice(0, promptIndex);
            console.info('[BluetoothProvider] Response before prompt:', 
              bytesToString(responseBytes),
              'Raw:', JSON.stringify(responseBytes)
            );

            const processedChunks = processResponseChunks(
              commandState.responseChunks,
              commandState.responseBuffer,
              promptIndex,
            );

            // Reset buffers
            commandState.responseBuffer = [];
            commandState.responseChunks = [];

            if (commandState.timeoutId) {
              clearTimeout(commandState.timeoutId);
              commandState.timeoutId = null;
            }

            let response;
            switch (commandState.expectedReturnType) {
              case CommandReturnType.STRING:
                response = bytesToString(responseBytes);
                console.info('[BluetoothProvider] Resolved string response:', response);
                break;
              case CommandReturnType.BYTES:
                response = Uint8Array.from(responseBytes);
                console.info('[BluetoothProvider] Resolved bytes response length:', response.length);
                break;
              case CommandReturnType.CHUNKED:
                response = {
                  data: Uint8Array.from(responseBytes),
                  chunks: processedChunks.map(chunk => Uint8Array.from(chunk)),
                };
                console.info('[BluetoothProvider] Resolved chunked response chunks:', response.chunks.length);
                break;
              default:
                response = bytesToString(responseBytes);
            }

            // Clear currentCommandRef before resolving to avoid any race conditions
            const promiseToResolve = commandState.promise;
            currentCommandRef.current = null;
            dispatch({ type: 'COMMAND_SUCCESS' });
            promiseToResolve.resolve(response);
          }
        } catch (error) {
          console.error(
            '[BluetoothProvider] Error processing incoming data:',
            error,
          );
          if (currentCommandRef.current?.promise) {
            currentCommandRef.current.promise.reject(handleError(error));
            currentCommandRef.current = null;
          }
          dispatch({ type: 'COMMAND_FAILURE', payload: handleError(error) });
        }
      } else {
        // Log unexpected data
        console.warn('[BluetoothProvider] Received data but no active command:', 
          bytesToString(dataValue),
          'Raw:', JSON.stringify(dataValue)
        );
      }
    },
    [state.isAwaitingResponse],
  );

  /**
   * Processes response chunks to handle partial responses and remove prompt bytes.
   *
   * @param chunks - Array of received data chunks
   * @param flatBuffer - Complete response buffer
   * @param promptIndex - Index of the prompt byte in the flat buffer
   * @returns Processed chunks with prompt byte removed
   */
  const processResponseChunks = (
    chunks: number[][],
    flatBuffer: number[],
    promptIndex: number,
  ): number[][] => {
    const processedChunks = [...chunks];
    let runningLength = 0;

    for (let i = 0; i < processedChunks.length; i++) {
      const chunkLength = processedChunks[i].length;

      if (runningLength + chunkLength > promptIndex) {
        const promptPositionInChunk = promptIndex - runningLength;
        processedChunks[i] = processedChunks[i].slice(0, promptPositionInChunk);
        processedChunks.splice(i + 1);
        break;
      }

      runningLength += chunkLength;
    }

    return processedChunks;
  };

  /**
   * Ensures consistent error handling by converting any error type to Error.
   *
   * @param error - The error to handle
   * @returns A standardized Error object
   */
  const handleError = (error: unknown): Error => {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  };

  // Use refs to store listeners to ensure they are removed correctly
  const listenersRef = useRef<EmitterSubscription[]>([]);

  /**
   * Initializes the BLE manager and checks initial Bluetooth state.
   * This effect runs once when the component mounts.
   */
  useEffect(() => {
    console.info('[BluetoothProvider] Initializing BleManager...');

    BleManager.start({ showAlert: false })
      .then(() => {
        console.info('[BluetoothProvider] BleManager started successfully.');
        dispatch({ type: 'SET_INITIALIZING', payload: false });
        BleManager.checkState();
      })
      .catch((error: Error) => {
        console.error('[BluetoothProvider] BleManager failed to start:', error);
        dispatch({ type: 'SET_INITIALIZING', payload: false });
        dispatch({
          type: 'SET_ERROR',
          payload: new Error(`BleManager failed to start: ${error}`),
        });
      });
  }, []);

  // Data Notification Listener - Re-register when handler changes
  useEffect(() => {
    console.info('[BluetoothProvider] Setting up BLE data notification listener...');
    const dataListener = bleManagerEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      (data: BleManagerDidUpdateValueForCharacteristicEvent) => {
        console.info(
          `[BluetoothProvider] Received data from characteristic: ${data.characteristic}`,
        );
        // console.log(JSON.stringify(data.value)); // Already logged in handleIncomingData

        // Directly call the handleIncomingData passed to this effect instance
        handleIncomingData(data.value);
      },
    );

    // Cleanup function removes the specific listener added in this effect run
    return () => {
      console.info('[BluetoothProvider] Removing BLE data notification listener...');
      dataListener.remove();
    };
  }, [handleIncomingData]); // Add handleIncomingData as a dependency

  // Other BLE State Listeners
  useEffect(() => {
    const listeners: EmitterSubscription[] = [];
    console.info('[BluetoothProvider] Setting up BLE state listeners...');

    // Bluetooth State Change Listener
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDidUpdateState',
        (args: { state: BleManagerState }) => {
          console.info(
            `[BluetoothProvider] BleManagerDidUpdateState: ${args.state}`,
          );
          const isBtOn = args.state === 'on';
          dispatch({ type: 'SET_BLUETOOTH_STATE', payload: isBtOn });
          if (!isBtOn) {
            console.warn('[BluetoothProvider] Bluetooth is OFF.');
          }
        },
      ),
    );

    // Device Discovery Listener
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        (peripheral: Peripheral) => {
          const name = peripheral.name?.toUpperCase() || '';
          const likelyOBDKeywords = [
            'OBD',
            'ELM',
            'VLINK',
            'SCAN',
            'ICAR',
            'KONNWEI',
          ];
          const isLikelyOBD = likelyOBDKeywords.some(keyword =>
            name.includes(keyword),
          );

          const peripheralWithPrediction: PeripheralWithPrediction = {
            ...peripheral,
            isLikelyOBD,
          };
          dispatch({ type: 'DEVICE_FOUND', payload: peripheralWithPrediction });
        },
      ),
    );

    // Scan Completion Listener
    listeners.push(
      bleManagerEmitter.addListener('BleManagerStopScan', () => {
        console.info('[BluetoothProvider] BleManagerStopScan received.');
        dispatch({ type: 'SCAN_STOP' });
      }),
    );

    // Device Disconnection Listener
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        (data: { peripheral: string }) => {
          console.warn(
            `[BluetoothProvider] BleManagerDisconnectPeripheral: ${data.peripheral}`,
          );
          if (state.connectedDevice?.id === data.peripheral) {
            if (currentCommandRef.current) {
              console.error(
                '[BluetoothProvider] Rejecting command due to disconnect.',
              );
              currentCommandRef.current.promise.reject(
                new Error('Device disconnected during command.'),
              );
              if (currentCommandRef.current.timeoutId) {
                clearTimeout(currentCommandRef.current.timeoutId);
              }
              currentCommandRef.current.responseBuffer = [];
              currentCommandRef.current = null;
            }
            dispatch({ type: 'DEVICE_DISCONNECTED' });
          }
        },
      ),
    );

    listenersRef.current = listeners;

    return () => {
      console.info('[BluetoothProvider] Removing BLE state listeners...');
      listenersRef.current.forEach(listener => listener.remove());
      listenersRef.current = [];
    };
  }, [state.connectedDevice?.id]); // Only re-run if connected device ID changes

  // Memoized provider value to prevent unnecessary re-renders
  const stateValue = useMemo(() => state, [state]);
  const dispatchValue = useMemo(() => dispatch, []);
  const commandControlValue = useMemo(
    () => ({
      currentCommandRef,
    }),
    [],
  );

  // Return wrapped in enhanced error boundary
  return (
    <BluetoothErrorBoundary
      onError={handleBoundaryError}
      fallback={fallbackUI}
      maxRetries={3}
    >
      <BluetoothStateContext.Provider value={stateValue}>
        <BluetoothDispatchContext.Provider value={dispatchValue}>
          <InternalCommandControlContext.Provider value={commandControlValue}>
            {children}
          </InternalCommandControlContext.Provider>
        </BluetoothDispatchContext.Provider>
      </BluetoothStateContext.Provider>
    </BluetoothErrorBoundary>
  );
};

/**
 * Internal hook for accessing the command control context.
 * This hook provides access to the internal command execution state
 * and is only meant to be used by the library's internal components.
 *
 * @internal
 * @throws {Error} When used outside of a BluetoothProvider
 * @returns Command control context object containing the current command reference
 *
 * @example
 * ```typescript
 * // Internal usage only
 * function InternalComponent() {
 *   const { currentCommandRef } = useInternalCommandControl();
 *   // Access command state...
 * }
 * ```
 */
export const useInternalCommandControl = () => {
  const context = React.useContext(InternalCommandControlContext);
  if (context === undefined) {
    throw new Error(
      'useInternalCommandControl must be used within a BluetoothProvider',
    );
  }
  return context;
};
