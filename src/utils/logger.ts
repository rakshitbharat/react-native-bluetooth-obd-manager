import { log as LogLib, initSessionLog } from 'react-native-beautiful-logs';

const ACTIVE_LOG = false;

// Initialize logging session
initSessionLog().catch(error => {
  console.error('Failed to initialize logging session:', error);
});

// Export wrapped logging functions with ECU tag
export const log = {
  debug: (message: string, ...args: unknown[]): void => {
    if (!ACTIVE_LOG) return;
    LogLib('debug', '[ECU]', message, ...args);
  },
  info: (message: string, ...args: unknown[]): void => {
    if (!ACTIVE_LOG) return;
    LogLib('info', '[ECU]', message, ...args);
  },
  warn: (message: string, ...args: unknown[]): void => {
    if (!ACTIVE_LOG) return;
    LogLib('warn', '[ECU]', message, ...args);
  },
  error: (message: string, ...args: unknown[]): void => {
    if (!ACTIVE_LOG) return;
    LogLib('error', '[ECU]', message, ...args);
  },
};
