Okay, here's the Markdown documentation explaining that the library *itself* doesn't automatically manage the specific type of "streaming active" flag you described, and clarifying how to achieve that effect using the library's tools.

This could go on a page explaining advanced usage patterns or clarifying the scope of the library's state management.

---

## Managing Continuous Data Fetching (Polling) State

You might want to track whether your application is currently engaged in active, ongoing communication with the OBD adapter, such as fetching data like RPM and speed repeatedly in a loop (polling). You might also want this "active communication" state to automatically turn off if no successful data exchange happens for a certain period (e.g., 4 seconds).

**Clarification: Library Primitives vs. Application Logic**

It's important to understand the distinction between the core tools provided by `react-native-bluetooth-obd-manager` and the application logic you build on top of them:

1.  **What the Library Provides (`sendCommand`):**
    *   The `sendCommand` function is designed to handle a **single command-response cycle**.
    *   It has its own **internal timeout** (defaulting to ~4 seconds) specifically for waiting for the response (signaled by `>`) to *that one command*. If the response to that *specific command* doesn't arrive within its timeout, the `sendCommand` promise rejects.

2.  **What the Library Does *Not* Automatically Manage:**
    *   The core `useBluetooth` hook and its functions do **not** automatically maintain a high-level state flag indicating that a *continuous polling loop* (fetching data repeatedly using `setInterval` or similar) is actively running.
    *   The library does **not** automatically monitor the *overall polling activity* and set such a flag to `false` if there hasn't been *any* successful communication (e.g., multiple `sendCommand` calls failing or timing out consecutively) within a 4-second window.

**User Responsibility for Polling State:**

Implementing and managing the state for continuous polling, including handling inactivity timeouts for the overall process, is typically done **within your application's component logic** using the library's primitives.

**How to Achieve This:**

*   **Manage State:** Use component state (e.g., `useState`) to track whether your polling loop is active (like the `isMonitoring` state in the example below).
*   **Implement Loop:** Use `setInterval` or a recursive `setTimeout` pattern to repeatedly call `sendCommand` for the desired PIDs.
*   **Handle Errors/Timeouts within the Loop:** Wrap your `sendCommand` calls within the loop in `try...catch`.
*   **Implement Inactivity Logic (Your Responsibility):**
    *   If `sendCommand` fails (especially with timeouts) repeatedly within your loop, your application code needs to decide when to give up.
    *   You could implement a counter for consecutive failures. If the counter exceeds a threshold, you would then:
        1.  Call `clearInterval` (or stop the recursive `setTimeout`).
        2.  Set your component's `isMonitoring` state back to `false`.
    *   This logic effectively creates the "stop streaming if no successful communication for X seconds" behavior at the application level.

**Example Reference:**

Refer to the [Usage Guide: Real-time Monitoring](https://github.com/rakshitbharat/react-native-bluetooth-obd-manager/wiki/Usage-Guide:-Real-time-Monitoring) example. Notice how it uses:
*   `useState` for `isMonitoring`.
*   `useRef` for the `intervalId`.
*   `try...catch` within the `fetchData` function called by `setInterval`.
*   Explicit calls to `startMonitoring` and `stopMonitoring` functions that manage the interval and the `isMonitoring` state.

```typescript
// Snippet from Real-time Monitoring Example - Illustrating App-Level Management

const RealTimeMonitor = () => {
  // ... other code ...
  const [isMonitoring, setIsMonitoring] = useState(false); // <-- App manages this state
  const [errorCount, setErrorCount] = useState(0); // <-- App tracks consecutive errors
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = async () => {
    // ... (check connection) ...
    try {
      // ... (await sendCommand for RPM) ...
      // ... (await sendCommand for Speed) ...
      setErrorCount(0); // Reset error count on success
    } catch (err: any) {
      console.error('Monitoring Error:', err);
      const newErrorCount = errorCount + 1;
      setErrorCount(newErrorCount);
       // *** Application Logic to stop after N failures (e.g., 4 failures ~ 4 seconds if interval is 1s) ***
      if (newErrorCount >= 4) {
         console.warn("Stopping monitoring due to persistent errors/timeouts.");
         stopMonitoring(); // App decides to stop the loop
      }
    }
  };

  const startMonitoring = () => {
    // ... (check connection) ...
    setIsMonitoring(true); // <-- App sets the state
    setErrorCount(0);
    // ... (start interval) ...
     intervalRef.current = setInterval(fetchData, 1000);
  };

  const stopMonitoring = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false); // <-- App sets the state
  };

  // ... useEffect cleanup ...
  // ... render logic ...
};
```

**Key Takeaway:** The library provides the timed `sendCommand` primitive; your application uses it to build polling loops and manages the state (`isMonitoring`) and overall inactivity logic for those loops.