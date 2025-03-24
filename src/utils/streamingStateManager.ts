import { Subject } from 'rxjs';

/**
 * Global streaming state manager for OBD communication
 * Handles timeout detection and stream state across the application
 */
export class StreamingStateManager {
  private static instance: StreamingStateManager;
  private timeoutId: NodeJS.Timeout | null = null;
  private startTime = 0;
  private isStreaming = false;
  private readonly MAX_STREAM_DURATION = 4000; // 4 seconds
  private streamStateSubject = new Subject<boolean>();

  /**
   * Get the singleton instance of StreamingStateManager
   */
  static getInstance(): StreamingStateManager {
    if (!StreamingStateManager.instance) {
      StreamingStateManager.instance = new StreamingStateManager();
    }
    return StreamingStateManager.instance;
  }

  /**
   * Start the streaming state and reset the timeout
   */
  startStreaming(): void {
    this.isStreaming = true;
    this.startTime = Date.now();
    this.setStreamTimeout();
    this.streamStateSubject.next(true);
    // eslint-disable-next-line no-console
    console.log('[StreamingStateManager] Streaming started');
  }

  /**
   * Stop the streaming state and clear any timeouts
   */
  stopStreaming(): void {
    if (!this.isStreaming) return; // Already stopped

    this.isStreaming = false;
    this.clearStreamTimeout();
    this.streamStateSubject.next(false);
    // eslint-disable-next-line no-console
    console.log('[StreamingStateManager] Streaming stopped');
  }

  /**
   * Set a timeout to automatically stop streaming after MAX_STREAM_DURATION
   */
  private setStreamTimeout(): void {
    this.clearStreamTimeout();
    this.timeoutId = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn('[StreamingStateManager] Stream timeout - force stopping stream');
      this.stopStreaming();
    }, this.MAX_STREAM_DURATION);
  }

  /**
   * Clear any existing stream timeout
   */
  private clearStreamTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Reset the stream timeout when data is received
   */
  resetStreamTimeout(): void {
    if (this.isStreaming) {
      this.setStreamTimeout();
    }
  }

  /**
   * Check if streaming is currently active
   */
  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  /**
   * Get the current duration of the stream in milliseconds
   */
  getStreamDuration(): number {
    return this.isStreaming ? Date.now() - this.startTime : 0;
  }

  /**
   * Get the maximum allowed stream duration in milliseconds
   */
  getMaxStreamDuration(): number {
    return this.MAX_STREAM_DURATION;
  }

  /**
   * Subscribe to changes in the streaming state
   * @param callback Function called whenever streaming state changes
   * @returns Unsubscribe function
   */
  onStreamStateChange(callback: (isStreaming: boolean) => void): () => void {
    const subscription = this.streamStateSubject.subscribe(callback);
    return () => subscription.unsubscribe();
  }
}

export default StreamingStateManager.getInstance();
