"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BluetoothStateContext = exports.BluetoothDispatchContext = void 0;
exports.useBluetoothDispatch = useBluetoothDispatch;
exports.useBluetoothState = useBluetoothState;
var _react = _interopRequireWildcard(require("react"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
// src/context/BluetoothContext.ts

/**
 * Context for accessing the Bluetooth state values.
 * Consumers should use `useContext(BluetoothStateContext)`.
 */
const BluetoothStateContext = exports.BluetoothStateContext = /*#__PURE__*/(0, _react.createContext)(undefined);

/**
 * Context for accessing the dispatch function to update Bluetooth state.
 * Consumers should use `useContext(BluetoothDispatchContext)`.
 */
const BluetoothDispatchContext = exports.BluetoothDispatchContext = /*#__PURE__*/(0, _react.createContext)(undefined);

// Optional: Provider names for React DevTools
BluetoothStateContext.displayName = 'BluetoothStateContext';
BluetoothDispatchContext.displayName = 'BluetoothDispatchContext';

/**
 * Hook to safely access the Bluetooth state context.
 * Throws an error if used outside of a BluetoothProvider.
 */
function useBluetoothState() {
  const context = _react.default.useContext(BluetoothStateContext);
  if (context === undefined) {
    throw new Error('useBluetoothState must be used within a BluetoothProvider');
  }
  return context;
}

/**
 * Hook to safely access the Bluetooth dispatch context.
 * Throws an error if used outside of a BluetoothProvider.
 */
function useBluetoothDispatch() {
  const context = _react.default.useContext(BluetoothDispatchContext);
  if (context === undefined) {
    throw new Error('useBluetoothDispatch must be used within a BluetoothProvider');
  }
  return context;
}
//# sourceMappingURL=BluetoothContext.js.map