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
  type TextStyle,
  StyleSheet,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import type { Peripheral, BleManagerState } from '../types';
import {
  BluetoothDispatchContext,
  BluetoothStateContext,
} from './BluetoothContext';
import { bluetoothReducer, initialState } from './BluetoothReducer';
import type { PeripheralWithPrediction, CommandExecutionState } from '../types';
import { log } from '../utils/logger';
import { useBluetoothListener } from '../hooks/useBluetoothListener';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

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
      log.error('[BluetoothErrorBoundary]', error);
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
      log.error('[BluetoothProvider] Error caught by boundary:', {
        error,
        errorInfo,
        deviceId: state.connectedDevice?.id,
        isConnecting: state.isConnecting,
        isScanning: state.isScanning,
      });

      dispatch({ type: 'SET_ERROR', payload: error });

      if (state.isConnecting || state.connectedDevice) {
        dispatch({ type: 'DEVICE_DISCONNECTED' });
      }

      if (state.isScanning) {
        dispatch({ type: 'SCAN_STOP' });
      }
    },
    [state.connectedDevice, state.isConnecting, state.isScanning],
  );

  // Color constants
  const colors = {
    errorBackground: '#FEE2E2',
    errorTitle: '#991B1B',
    errorText: '#7F1D1D',
  } as const;

  // Convert inline styles to StyleSheet with extracted colors
  const styles = StyleSheet.create({
    errorContainer: {
      padding: 20,
      backgroundColor: colors.errorBackground,
      borderRadius: 8,
      margin: 10,
    },
    errorTitle: {
      color: colors.errorTitle,
      fontSize: 16,
      fontWeight: '600' as TextStyle['fontWeight'],
      marginBottom: 8,
    },
    errorMessage: {
      color: colors.errorText,
      fontSize: 14,
    },
  });

  const fallbackUI = useMemo(
    () => (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Bluetooth Connection Error</Text>
        <Text style={styles.errorMessage}>
          There was a problem with the Bluetooth connection. The app will
          automatically try to recover.
        </Text>
      </View>
    ),
    [styles], // Add styles as dependency since we're using it
  );

  // Ensure state is never null during initialization
  useEffect(() => {
    if (!isInitialized.current) {
      dispatch({ type: 'SET_INITIALIZING', payload: true });
      isInitialized.current = true;
    }
  }, []);

  // --- Use the new hook for data listening ---
  useBluetoothListener(currentCommandRef, dispatch);

  // Use refs to store listeners to ensure they are removed correctly
  const listenersRef = useRef<EmitterSubscription[]>([]);

  /**
   * Initializes the BLE manager and checks initial Bluetooth state.
   * This effect runs once when the component mounts.
   */
  useEffect(() => {
    log.info('[BluetoothProvider] Initializing BleManager...');

    BleManager.start({ showAlert: false })
      .then(() => {
        log.info('[BluetoothProvider] BleManager started successfully.');
        dispatch({ type: 'SET_INITIALIZING', payload: false });
        BleManager.checkState();
      })
      .catch((error: Error) => {
        log.error('[BluetoothProvider] BleManager failed to start:', error);
        dispatch({ type: 'SET_INITIALIZING', payload: false });
        dispatch({
          type: 'SET_ERROR',
          payload: new Error(`BleManager failed to start: ${error}`),
        });
      });
  }, []);

  // Other BLE State Listeners
  useEffect(() => {
    const listeners: EmitterSubscription[] = [];
    log.info('[BluetoothProvider] Setting up BLE state listeners...');

    // Bluetooth State Change Listener
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDidUpdateState',
        (args: { state: BleManagerState }) => {
          log.info(
            `[BluetoothProvider] BleManagerDidUpdateState: ${args.state}`,
          );
          const isBtOn = args.state === 'on';
          dispatch({ type: 'SET_BLUETOOTH_STATE', payload: isBtOn });
          if (!isBtOn) {
            log.warn('[BluetoothProvider] Bluetooth is OFF.');
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
        log.info('[BluetoothProvider] BleManagerStopScan received.');
        dispatch({ type: 'SCAN_STOP' });
      }),
    );

    // Device Disconnection Listener
    listeners.push(
      bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        (data: { peripheral: string }) => {
          log.warn(
            `[BluetoothProvider] BleManagerDisconnectPeripheral: ${data.peripheral}`,
          );
          if (state.connectedDevice?.id === data.peripheral) {
            if (currentCommandRef.current) {
              log.error(
                '[BluetoothProvider] Rejecting command due to disconnect.',
              );
              // Ensure promise exists before rejecting
              currentCommandRef.current.promise?.reject(
                new Error('Device disconnected during command.'),
              );
              if (currentCommandRef.current.timeoutId) {
                clearTimeout(currentCommandRef.current.timeoutId);
              }
              // Clear received chunks on disconnect if command was active
              if (currentCommandRef.current.receivedRawChunks) {
                currentCommandRef.current.receivedRawChunks = [];
              }
              currentCommandRef.current = null;
            }
            dispatch({ type: 'DEVICE_DISCONNECTED' });
          }
        },
      ),
    );

    listenersRef.current = listeners;

    return () => {
      log.info('[BluetoothProvider] Removing BLE state listeners...');
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
