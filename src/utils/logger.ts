import { log as LogLib, initSessionLog } from 'react-native-beautiful-logs';

// Initialize logging session
initSessionLog().catch(error => {
  console.error('Failed to initialize logging session:', error);
});

// Export wrapped logging functions with ECU tag
export const log = {
  debug: (message: string, ...args: unknown[]): void => {
    LogLib('debug', '[ECU]', message, ...args);
  },
  info: (message: string, ...args: unknown[]): void => {
    LogLib('info', '[ECU]', message, ...args);
  },
  warn: (message: string, ...args: unknown[]): void => {
    LogLib('warn', '[ECU]', message, ...args);
  },
  error: (message: string, ...args: unknown[]): void => {
    LogLib('error', '[ECU]', message, ...args);
  }
};
