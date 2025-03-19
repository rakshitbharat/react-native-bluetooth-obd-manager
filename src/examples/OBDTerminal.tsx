import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import useBluetooth from '../hooks/useBluetooth';
import { ScrollViewMethod } from '../types/declarations';
import { ELM_COMMANDS } from '../utils/obdUtils';

interface LogEntry {
  type: 'sent' | 'received' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

// Common OBD commands for quick access
const QUICK_COMMANDS = [
  { label: 'Reset', command: ELM_COMMANDS.RESET },
  { label: 'Version', command: ELM_COMMANDS.GET_VERSION },
  { label: 'Protocol', command: ELM_COMMANDS.GET_PROTOCOL },
  { label: 'RPM', command: '010C' },
  { label: 'Speed', command: '010D' },
  { label: 'Temp', command: '0105' },
];

const OBDTerminalComponent: React.FC = () => {
  const { connectedDevice, sendCommand } = useBluetooth();
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollViewRef = useRef<any>(null);

  // Add log entry
  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(currentLogs => [...currentLogs, { type, message, timestamp: new Date() }]);
  };

  // Scroll to bottom if auto-scroll is enabled
  useEffect(() => {
    if (autoScroll && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [logs, autoScroll]);

  // Send a command and handle response
  const handleSendCommand = async (cmd: string) => {
    if (!connectedDevice) {
      addLog('error', 'No device connected');
      return;
    }

    if (!cmd.trim()) {
      addLog('error', 'Please enter a command');
      return;
    }

    // Clean up command
    const cleanCommand = cmd.trim().toUpperCase();
    addLog('sent', cleanCommand);
    setCommand(''); // Clear input

    try {
      const response = await sendCommand(cleanCommand);
      addLog('received', response);
    } catch (error) {
      addLog('error', `Error: ${(error as Error).message}`);
    }
  };

  // Clear the log
  const clearLog = () => {
    setLogs([]);
  };

  // Format timestamp
  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>OBD Terminal</Text>
        <TouchableOpacity style={styles.clearButton} onPress={clearLog}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.logContainer}
        onContentSizeChange={() => {
          if (autoScroll) {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }
        }}
      >
        {logs.map((log, index) => (
          <View key={index} style={styles.logEntry}>
            <Text style={styles.timestamp}>{formatTimestamp(log.timestamp)}</Text>
            <Text
              style={[
                styles.logText,
                log.type === 'sent' && styles.sentText,
                log.type === 'received' && styles.receivedText,
                log.type === 'error' && styles.errorText,
                log.type === 'info' && styles.infoText,
              ]}
            >
              {log.type === 'sent' ? '> ' : ''}
              {log.message}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.quickCommands}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {QUICK_COMMANDS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickCommandButton}
              onPress={() => handleSendCommand(item.command)}
              disabled={!connectedDevice}
            >
              <Text style={styles.quickCommandText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={command}
          onChangeText={setCommand}
          placeholder="Enter command..."
          placeholderTextColor="#666"
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={() => handleSendCommand(command)}
          editable={!!connectedDevice}
        />
        <TouchableOpacity
          style={[styles.sendButton, !connectedDevice && styles.sendButtonDisabled]}
          onPress={() => handleSendCommand(command)}
          disabled={!connectedDevice}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.autoScrollButton} onPress={() => setAutoScroll(!autoScroll)}>
        <Text style={[styles.autoScrollText, !autoScroll && styles.autoScrollDisabled]}>
          Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2D2D2D',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#4CAF50',
  },
  logContainer: {
    flex: 1,
    padding: 8,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  timestamp: {
    color: '#666',
    fontSize: 12,
    marginRight: 8,
  },
  logText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  sentText: {
    color: '#4CAF50',
  },
  receivedText: {
    color: '#2196F3',
  },
  errorText: {
    color: '#F44336',
  },
  infoText: {
    color: '#FFC107',
  },
  quickCommands: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#2D2D2D',
  },
  quickCommandButton: {
    backgroundColor: '#424242',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  quickCommandText: {
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#2D2D2D',
  },
  input: {
    flex: 1,
    backgroundColor: '#424242',
    color: '#FFFFFF',
    padding: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#666',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  autoScrollButton: {
    padding: 8,
    alignItems: 'center',
    backgroundColor: '#2D2D2D',
  },
  autoScrollText: {
    color: '#4CAF50',
  },
  autoScrollDisabled: {
    color: '#666',
  },
});

export const OBDTerminal = OBDTerminalComponent;
