import { createRecognitionStream, isSpeechClientAvailable } from '../speech/speechHandler.js';
import { synthesizeSpeech, isTextToSpeechAvailable } from '../speech/textToSpeech.js';
import { generateCodeFromConversation } from '../agent/codeAgent.js';
import { getRecentTranscriptionsForBranch } from '../db/database.js';

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

        case 'generate_code':
          // Use connectionInfo from message if available, otherwise use stored connectionInfo
          const repoId = message.repoId || connectionInfo?.repoId;
          const userName = message.userName || connectionInfo?.userName;
          const branch = message.branch || connectionInfo?.branch;
          
          console.log(`Generating code for repo: ${repoId}, branch: ${branch}`);
          
          if (!repoId || !userName || !branch) {
            console.error('Missing connection info for code generation');
            break;
          }

          // Get last 60 minutes of conversation for entire branch (all users)
          try {
            const conversations = await getRecentTranscriptionsForBranch(
              repoId,
              branch,
              60
            );

            if (conversations.length === 0) {
              console.log('No conversations found in the last 60 minutes');
              // Send response with empty result
              ws.send(JSON.stringify({
                type: 'code_generation_result',
                result: {
                  summary: 'No conversations found in the last 60 minutes. Please have some conversations first.',
                  files: []
                }
              }));
              break;
            }

            console.log(`Found ${conversations.length} conversation messages from all users`);

            // Generate code using the agent
            let result;
            try {
              result = await generateCodeFromConversation(
                repoId,
                branch,
                conversations
              );

              // Output to console
              console.log('\n=== Code Generation Result ===');
              console.log(JSON.stringify(result, null, 2));
            } catch (error) {
              console.error('Error generating code:', error);
              // Return error as summary instead of failing
              result = {
                summary: `Error during code generation: ${error.message}`,
                files: []
              };
            }

            // Generate audio from summary if text-to-speech is available
            let audioBuffer = null;
            if (isTextToSpeechAvailable() && result.summary) {
              try {
                // Create a short summary message for speech
                const summaryText = result.summary.length > 500 
                  ? result.summary.substring(0, 500) + '...' 
                  : result.summary;
                const speechText = `Code generation complete. ${summaryText}`;
                
                audioBuffer = await synthesizeSpeech(speechText);
                console.log(`Generated audio from summary (${audioBuffer.length} bytes)`);
              } catch (error) {
                console.warn('Failed to generate speech from summary, continuing without audio:', error.message);
                // Continue normally even if speech generation fails
              }
            }

            // Send result to client via websocket
            const message = {
              type: 'code_generation_result',
              result: result
            };

            // If audio was generated, send it as base64
            if (audioBuffer) {
              message.audio = audioBuffer.toString('base64');
              message.audioFormat = 'mp3';
            }

            ws.send(JSON.stringify(message));
          } catch (error) {
            console.error('Error in code generation process:', error);
            // Send error response with error as summary
            ws.send(JSON.stringify({
              type: 'code_generation_result',
              result: {
                summary: `Error: ${error.message}`,
                files: []
              }
            }));
          }
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

