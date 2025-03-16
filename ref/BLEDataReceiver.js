class BLEDataReceiver {
  constructor() {
    if (!BLEDataReceiver.instance) {
      this.initializeProperties();
      BLEDataReceiver.instance = this;
    }
    return BLEDataReceiver.instance;
  }

  initializeProperties() {
    this.responseBuffer = '';
    this.rawResponseBuffer = [];
    this.last_response_from_device = null;
    this.raw_response_from_device = null;
    this.complete_response_received = false;
    this.currentProtocol = null;
  }

  updateValueFromCharacteristic({value}) {
    if (!value) return;
    this.rawResponseBuffer.push(value);
    this.appendToBuffer(value);

    if (this.isPromptDetected()) {
      const completeRawResponse = [...this.rawResponseBuffer];
      this.emitRawResponse(completeRawResponse);
      this.processBuffer();
      this.handleCompleteResponse();
      this.resetBuffers();
    }
  }

  emitRawResponse(value) {
    this.raw_response_from_device = value;
  }

  appendToBuffer(value) {
    this.emitLastResponse(value);
    const decodedValue = this.byteArrayToString(value);
    this.updateResponseBuffer(decodedValue);
  }

  emitLastResponse(decodedValue) {
    this.last_response_from_device = decodedValue;
  }

  updateResponseBuffer(decodedValue) {
    this.responseBuffer += decodedValue;
  }

  isPromptDetected() {
    return this.responseBuffer.endsWith('>');
  }

  processBuffer() {
    if (!this.responseBuffer) return;
    const nonProcessedData = this.responseBuffer;
    const nonProcessedRawResponseBuffer = this.rawResponseBuffer;
  }

  resetBuffers() {
    this.responseBuffer = '';
    this.rawResponseBuffer = [];
  }

  cleanReceivedResponse(response) {
    return response
      .trim()
      .replace(/[^ -~]+/g, '')
      .replace(/[\r>]/g, '')
      .replace(/SEARCHING\.\.\./, '')
      .replace(/AT[A-Z0-9]*\d*/, '')
      .replace(/(BUS INIT)|(BUSINIT)|(\.)/g, '')
      .replace(/\s+/g, '');
  }

  handleCompleteResponse() {
    this.complete_response_received = true;
  }

  byteArrayToString(bytes) {
    if (!bytes) return '';
    try {
      return String.fromCharCode.apply(null, bytes);
    } catch (error) {
      return '';
    }
  }
}

export default new BLEDataReceiver();

export const flushEverything = () => {
  if (BLEDataReceiver.instance) {
    const oldProtocol = BLEDataReceiver.instance.currentProtocol;
    BLEDataReceiver.instance.initializeProperties();
    BLEDataReceiver.instance.currentProtocol = oldProtocol;
    BLEDataReceiver.instance.complete_response_received = false;
  }
};
