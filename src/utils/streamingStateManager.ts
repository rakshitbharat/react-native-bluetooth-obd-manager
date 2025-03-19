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

  private constructor() {}

  static getInstance(): StreamingStateManager {
    if (!StreamingStateManager.instance) {
      StreamingStateManager.instance = new StreamingStateManager();
    }
    return StreamingStateManager.instance;
  }

  startStreaming(): void {
    this.isStreaming = true;
    this.startTime = Date.now();
    this.setStreamTimeout();
    this.streamStateSubject.next(true);
  }

  stopStreaming(): void {
    this.isStreaming = false;
    this.clearStreamTimeout();
    this.streamStateSubject.next(false);
  }

  private setStreamTimeout(): void {
    this.clearStreamTimeout();
    this.timeoutId = setTimeout(() => {
      console.warn('Stream timeout - force stopping stream');
      this.stopStreaming();
    }, this.MAX_STREAM_DURATION);
  }

  private clearStreamTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  resetStreamTimeout(): void {
    if (this.isStreaming) {
      this.setStreamTimeout();
    }
  }

  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  getStreamDuration(): number {
    return this.isStreaming ? Date.now() - this.startTime : 0;
  }

  onStreamStateChange(callback: (isStreaming: boolean) => void): () => void {
    const subscription = this.streamStateSubject.subscribe(callback);
    return () => subscription.unsubscribe();
  }
}

export default StreamingStateManager.getInstance();