"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _react = _interopRequireDefault(require("react"));
var _BluetoothProvider = require("../context/BluetoothProvider");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const Wrapper = ({
  children
}) => /*#__PURE__*/_react.default.createElement(_BluetoothProvider.BluetoothProvider, null, children);
var _default = exports.default = Wrapper;
//# sourceMappingURL=Wrapper.js.map