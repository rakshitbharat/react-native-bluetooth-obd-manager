import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useBluetooth } from '../hooks/useBluetooth';
import { useECUCommands } from '../hooks/useECUCommands';
import { ELM_COMMANDS } from '../utils/obdUtils';

interface CommandLog {
  command: string;
  response: string;
  timestamp: number;
}

const OBDTerminal: React.FC<{ deviceId?: string }> = ({ deviceId }) => {
  const [command, setCommand] = useState<string>('');
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const scrollViewRef = React.useRef<ScrollView>(null);
  
  // Get Bluetooth functions
  const { 
    connectToDevice, 
    disconnect, 
    sendCommand,
    connectedDevice,
    isStreaming
  } = useBluetooth();
  
  // Get OBD commands
  const { initializeOBD } = useECUCommands();
  
  // Handle device connection
  useEffect(() => {
    if (deviceId && !connectedDevice) {
      connectDevice(deviceId);
    }
    
    return () => {
      if (connectedDevice) {
        disconnect(connectedDevice.id);
      }
    };
  }, [deviceId]);
  
  // Update connection status
  useEffect(() => {
    setIsConnected(!!connectedDevice);
  }, [connectedDevice]);
  
  // Connect to device
  const connectDevice = async (id: string) => {
    try {
      const success = await connectToDevice(id);
      
      if (success) {
        addLog('SYSTEM', 'Connected to device');
        
        // Initialize OBD
        await initializeOBD();
        addLog('SYSTEM', 'OBD initialized');
      } else {
        addLog('SYSTEM', 'Connection failed');
      }
    } catch (error) {
      addLog('SYSTEM', `Error: ${(error as Error).message}`);
    }
  };
  
  // Send command
  const handleSendCommand = async () => {
    if (!command.trim() || !isConnected) return;
    
    const cmd = command.trim();
    setCommand('');
    
    try {
      addLog(cmd, 'Pending...');
      const response = await sendCommand(cmd);
      
      // Update the last log
      setLogs(currentLogs => {
        const newLogs = [...currentLogs];
        newLogs[newLogs.length - 1].response = response || 'No response';
        return newLogs;
      });
    } catch (error) {
      // Update the last log with error
      setLogs(currentLogs => {
        const newLogs = [...currentLogs];
        newLogs[newLogs.length - 1].response = `Error: ${(error as Error).message}`;
        return newLogs;
      });
    }
  };
  
  // Add a log entry
  const addLog = (cmd: string, response: string) => {
    setLogs(currentLogs => [
      ...currentLogs,
      {
        command: cmd,
        response,
        timestamp: Date.now()
      }
    ]);
    
    // Scroll to bottom after log is added
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };
  
  // Quick commands
  const quickCommands = [
    { label: 'Reset', command: ELM_COMMANDS.RESET },
    { label: 'Battery', command: ELM_COMMANDS.READ_VOLTAGE },
    { label: 'Protocol', command: ELM_COMMANDS.GET_PROTOCOL },
  ];
  
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          Status: {isConnected ? 'Connected' : 'Disconnected'}
          {isStreaming ? ' (Streaming...)' : ''}
        </Text>
      </View>
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.logContainer}
        contentContainerStyle={styles.logContent}
      >
        {logs.map((log, index) => (
          <View key={index} style={styles.logEntry}>
            <Text style={styles.timestamp}>
              {new Date(log.timestamp).toLocaleTimeString()}
            </Text>
            <Text style={styles.command}>&gt; {log.command}</Text>
            <Text style={styles.response}>{log.response}</Text>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.quickCommandsContainer}>
        {quickCommands.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickCommandButton}
            onPress={() => {
              setCommand(item.command);
              setTimeout(() => handleSendCommand(), 100);
            }}
            disabled={!isConnected}
          >
            <Text style={styles.quickCommandText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={command}
          onChangeText={setCommand}
          placeholder="Enter OBD command..."
          placeholderTextColor="#aaa"
          autoCapitalize="characters"
          onSubmitEditing={handleSendCommand}
        />
        <TouchableOpacity
          style={[styles.sendButton, !isConnected && styles.disabledButton]}
          onPress={handleSendCommand}
          disabled={!isConnected}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  statusBar: {
    backgroundColor: '#333',
    padding: 10,
  },
  statusText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  logContainer: {
    flex: 1,
  },
  logContent: {
    padding: 10,
  },
  logEntry: {
    marginBottom: 15,
  },
  timestamp: {
    color: '#888',
    fontSize: 12,
    marginBottom: 2,
  },
  command: {
    color: '#2196F3',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  response: {
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  quickCommandsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  quickCommandButton: {
    backgroundColor: '#444',
    padding: 8,
    borderRadius: 4,
    flex: 1,
    margin: 2,
    alignItems: 'center',
  },
  quickCommandText: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#333',
  },
  input: {
    flex: 1,
    backgroundColor: '#252525',
    color: '#fff',
    padding: 10,
    borderRadius: 4,
    marginRight: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sendButton: {
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: 4,
  },
  sendButtonText: {
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#555',
  },
});

export default OBDTerminal;
