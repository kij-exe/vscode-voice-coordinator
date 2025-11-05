import { createRecognitionStream, isSpeechClientAvailable } from '../speech/speechHandler.js';

/**
 * Setup WebSocket server for audio streaming
 */
export function setupWebSocket(wss) {
  console.log('Setting up WebSocket server...');
  
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    console.log(`\n=== WebSocket Connection Established ===`);
    console.log(`WebSocket client connected from ${clientIp}`);

    let recognizeStream = null;
    let connectionInfo = null;

    // Handle incoming messages
    ws.on('message', async (data, isBinary) => {
      try {
        // If it's a text message (JSON), parse it
        if (!isBinary && typeof data === 'string') {
          const message = JSON.parse(data);
          await handleControlMessage(ws, message);
        } else if (isBinary && Buffer.isBuffer(data)) {
          // Binary message - could be audio data or JSON stringified as binary
          // Check if it starts with '{' (JSON) or assume it's audio
          if (data.length > 0 && data[0] === 0x7B) { // '{' character
            try {
              const message = JSON.parse(data.toString('utf-8'));
              await handleControlMessage(ws, message);
            } catch (e) {
              // Not valid JSON, treat as audio
              handleAudioData(ws, data, recognizeStream);
            }
          } else {
            // Binary audio data
            handleAudioData(ws, data, recognizeStream);
          }
        } else {
          // Fallback: try to parse as string
          try {
            const message = JSON.parse(data.toString());
            await handleControlMessage(ws, message);
          } catch (e) {
            // If not JSON and not binary, treat as audio buffer
            if (Buffer.isBuffer(data)) {
              handleAudioData(ws, data, recognizeStream);
            }
          }
        }
      } catch (error) {
        console.error('Error handling message:', error);
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    });

    async function handleControlMessage(ws, message) {
      console.log(`Received control message:`, message.type);
      
      switch (message.type) {
        case 'start':
          console.log(`Starting recognition for:`, {
            repoId: message.repoId,
            userName: message.userName,
            branch: message.branch || 'main',
            encoding: message.encoding || 'LINEAR16',
            sampleRate: message.sampleRate || 16000,
            languageCode: message.languageCode || 'en-US'
          });
          
          // Initialize connection info
          connectionInfo = {
            repoId: message.repoId,
            userName: message.userName,
            branch: message.branch || 'main'
          };

          // Check if speech client is available
          if (!isSpeechClientAvailable()) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Speech-to-Text service not available'
            }));
            return;
          }

          // Create recognition stream with callback to send transcriptions to client
          try {
            recognizeStream = createRecognitionStream(
              {
                encoding: message.encoding || 'LINEAR16',
                sampleRate: message.sampleRate || 16000,
                languageCode: message.languageCode || 'en-US'
              },
              connectionInfo,
              (transcript, isFinal, error) => {
                if (error) {
                  ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Recognition error: ' + error.message
                  }));
                } else if (transcript) {
                  // Send transcript to client
                  ws.send(JSON.stringify({
                    type: 'transcription',
                    transcript,
                    isFinal,
                    timestamp: new Date().toISOString()
                  }));
                }
              }
            );

            ws.send(JSON.stringify({ type: 'started' }));
          } catch (error) {
            console.error('Error creating recognition stream:', error);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to create recognition stream: ' + error.message
            }));
          }
          break;

        case 'stop':
          console.log(`Stopping recognition`);
          if (recognizeStream) {
            recognizeStream.end();
            recognizeStream = null;
          }
          ws.send(JSON.stringify({ type: 'stopped' }));
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${message.type}`
          }));
      }
    }

    function handleAudioData(ws, audioData, stream) {
      if (stream && stream.writable) {
        stream.write(audioData);
      } else {
        console.warn(`Audio data received but recognition stream not started (${audioData.length} bytes)`);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Recognition stream not started. Send start message first.'
        }));
      }
    }

    ws.on('close', (code, reason) => {
      const reasonStr = reason ? reason.toString() : 'No reason provided';
      console.log(`WebSocket connection closed`);
      console.log(`Close code: ${code}, Reason: ${reasonStr}`);
      if (connectionInfo) {
        console.log(`Connection info:`, {
          repoId: connectionInfo.repoId,
          userName: connectionInfo.userName,
          branch: connectionInfo.branch
        });
      }
      if (recognizeStream) {
        console.log(`Ending recognition stream`);
        recognizeStream.end();
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error:`, error.message || error);
      console.error(`Error stack:`, error.stack);
      if (recognizeStream) {
        console.log(`Ending recognition stream due to error`);
        recognizeStream.end();
      }
    });
  });
}

