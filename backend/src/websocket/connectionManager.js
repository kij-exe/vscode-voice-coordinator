import { handleMessage } from './messageHandlers.js';

/**
 * Connection state for a WebSocket connection
 */
class ConnectionState {
  constructor() {
    this.recognizeStream = null;
    this.connectionInfo = null;
  }

  setRecognizeStream(stream) {
    this.recognizeStream = stream;
  }

  getRecognizeStream() {
    return this.recognizeStream;
  }

  setConnectionInfo(info) {
    this.connectionInfo = info;
  }

  getConnectionInfo() {
    return this.connectionInfo;
  }

  stopRecognition() {
    if (this.recognizeStream) {
      this.recognizeStream.end();
      this.recognizeStream = null;
    }
  }

  cleanup() {
    this.stopRecognition();
    this.connectionInfo = null;
  }
}

/**
 * Parse incoming WebSocket message
 * @param {Buffer|string} data - Raw message data
 * @param {boolean} isBinary - Whether the message is binary
 * @returns {Object} Parsed message with type and data
 * @throws {Error} If JSON parsing fails for text messages
 */
function parseMessage(data, isBinary) {
  // Binary message - assume it's audio
  if (isBinary) {
    return { type: 'audio', data };
  }

  // Text message - treat as JSON
  try {
    const jsonData = typeof data === 'string' ? data : data.toString();
    return { type: 'json', data: JSON.parse(jsonData) };
  } catch (error) {
    throw new Error(`Failed to parse JSON message: ${error.message}`);
  }
}

/**
 * Handle WebSocket connection close
 * @param {number} code - Close code
 * @param {Buffer} reason - Close reason
 * @param {ConnectionState} state - Connection state
 */
function handleConnectionClose(code, reason, state) {
  const reasonStr = reason ? reason.toString() : 'No reason provided';
  console.log('WebSocket connection closed');
  console.log(`Close code: ${code}, Reason: ${reasonStr}`);

  const connectionInfo = state.getConnectionInfo();
  if (connectionInfo) {
    console.log('Connection info:', {
      repoId: connectionInfo.repoId,
      userName: connectionInfo.userName,
      branch: connectionInfo.branch
    });
  }

  state.cleanup();
}

/**
 * Handle WebSocket connection error
 * @param {Error} error - Error object
 * @param {ConnectionState} state - Connection state
 */
function handleConnectionError(error, state) {
  console.error('WebSocket error:', error.message || error);
  console.error('Error stack:', error.stack);

  if (state.getRecognizeStream()) {
    console.log('Ending recognition stream due to error');
    state.stopRecognition();
  }
}

/**
 * Setup WebSocket server for real-time communication
 * @param {Object} wss - WebSocket server instance
 */
export function setupWebSocket(wss) {
  console.log('Setting up WebSocket server...');

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    console.log('\n=== WebSocket Connection Established ===');
    console.log(`WebSocket client connected from ${clientIp}`);

    const state = new ConnectionState();

    // Handle incoming messages
    ws.on('message', async (data, isBinary) => {
      try {
        const parsedMessage = parseMessage(data, isBinary);
        await handleMessage(ws, parsedMessage, state);
      } catch (error) {
        console.error('Error handling message:', error);
        sendError(ws, error.message);
      }
    });

    // Handle connection close
    ws.on('close', (code, reason) => {
      handleConnectionClose(code, reason, state);
    });

    // Handle connection errors
    ws.on('error', (error) => {
      handleConnectionError(error, state);
    });
  });
}

/**
 * Send error message to WebSocket client
 * @param {Object} ws - WebSocket instance
 * @param {string} message - Error message
 */
function sendError(ws, message) {
  ws.send(JSON.stringify({
    type: 'error',
    message
  }));
}

