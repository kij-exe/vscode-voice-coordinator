import { createRecognitionStream, isSpeechClientAvailable } from '../speech/speechHandler.js';
import { synthesizeSpeech, isTextToSpeechAvailable } from '../speech/textToSpeech.js';
import { generateCodeFromConversation } from '../agent/codeAgent.js';
import { getRecentTranscriptionsForBranch } from '../db/database.js';

/**
 * Send message to WebSocket client
 * @param {Object} ws - WebSocket instance
 * @param {Object} message - Message object
 */
function sendMessage(ws, message) {
  ws.send(JSON.stringify(message));
}

/**
 * Send error message to WebSocket client
 * @param {Object} ws - WebSocket instance
 * @param {string} errorMessage - Error message
 */
function sendError(ws, errorMessage) {
  sendMessage(ws, {
    type: 'error',
    message: errorMessage
  });
}

/**
 * Handle start recognition message
 * @param {Object} ws - WebSocket instance
 * @param {Object} message - Message object
 * @param {ConnectionState} state - Connection state
 */
async function handleStartRecognition(ws, message, state) {
  console.log('Starting recognition for:', {
    repoId: message.repoId,
    userName: message.userName,
    branch: message.branch || 'main',
    encoding: message.encoding || 'LINEAR16',
    sampleRate: message.sampleRate || 16000,
    languageCode: message.languageCode || 'en-US'
  });

  const connectionInfo = {
    repoId: message.repoId,
    userName: message.userName,
    branch: message.branch || 'main'
  };
  state.setConnectionInfo(connectionInfo);

  if (!isSpeechClientAvailable()) {
    sendError(ws, 'Speech-to-Text service not available');
    return;
  }

  try {
    const recognizeStream = createRecognitionStream(
      {
        encoding: message.encoding || 'LINEAR16',
        sampleRate: message.sampleRate || 16000,
        languageCode: message.languageCode || 'en-US'
      },
      connectionInfo,
      (transcript, isFinal, error) => {
        if (error) {
          sendError(ws, `Recognition error: ${error.message}`);
        } else if (transcript) {
          sendTranscription(ws, transcript, isFinal);
        }
      }
    );

    state.setRecognizeStream(recognizeStream);
    sendMessage(ws, { type: 'started' });
  } catch (error) {
    console.error('Error creating recognition stream:', error);
    sendError(ws, `Failed to create recognition stream: ${error.message}`);
  }
}

/**
 * Handle stop recognition message
 * @param {Object} ws - WebSocket instance
 * @param {ConnectionState} state - Connection state
 */
function handleStopRecognition(ws, state) {
  console.log('Stopping recognition');
  state.stopRecognition();
  sendMessage(ws, { type: 'stopped' });
}

/**
 * Send transcription to client
 * @param {Object} ws - WebSocket instance
 * @param {string} transcript - Transcription text
 * @param {boolean} isFinal - Whether the transcription is final
 */
function sendTranscription(ws, transcript, isFinal) {
  sendMessage(ws, {
    type: 'transcription',
    transcript,
    isFinal,
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle audio data from WebSocket
 * @param {Object} ws - WebSocket instance
 * @param {Buffer} audioData - Audio data buffer
 * @param {ConnectionState} state - Connection state
 */
function handleAudioData(ws, audioData, state) {
  const recognizeStream = state.getRecognizeStream();

  if (recognizeStream && recognizeStream.writable) {
    recognizeStream.write(audioData);
  } else {
    console.warn(`Audio data received but recognition stream not started (${audioData.length} bytes)`);
    sendError(ws, 'Recognition stream not started. Send start message first.');
  }
}

/**
 * Generate code from conversations
 * @param {string} repoId - Repository ID
 * @param {string} branch - Branch name
 * @param {Array<Object>} conversations - Conversation transcripts
 * @returns {Promise<Object>} Code generation result
 */
async function generateCode(repoId, branch, conversations) {
  try {
    const result = await generateCodeFromConversation(repoId, branch, conversations);
    console.log('\n=== Code Generation Result ===');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Error generating code:', error);
    return {
      summary: `Error during code generation: ${error.message}`,
      files: []
    };
  }
}

/**
 * Generate audio from summary text
 * @param {string} summary - Summary text
 * @returns {Promise<Buffer|null>} Audio buffer or null
 */
async function generateAudioFromSummary(summary) {
  if (!isTextToSpeechAvailable() || !summary) {
    return null;
  }

  const SUMMARY_MAX_LENGTH = 500;
  try {
    const summaryText = summary.length > SUMMARY_MAX_LENGTH
      ? summary.substring(0, SUMMARY_MAX_LENGTH) + '...'
      : summary;
    const audioBuffer = await synthesizeSpeech(summaryText);
    console.log(`Generated audio from summary (${audioBuffer.length} bytes)`);
    return audioBuffer;
  } catch (error) {
    console.warn('Failed to generate speech from summary, continuing without audio:', error.message);
    return null;
  }
}

/**
 * Send code generation result to client
 * @param {Object} ws - WebSocket instance
 * @param {Object} result - Code generation result
 * @param {Buffer|null} audioBuffer - Optional audio buffer
 */
function sendCodeGenerationResult(ws, result, audioBuffer = null) {
  const message = {
    type: 'code_generation_result',
    result
  };

  if (audioBuffer) {
    message.audio = audioBuffer.toString('base64');
    message.audioFormat = 'mp3';
  }

  sendMessage(ws, message);
}

/**
 * Handle code generation message
 * @param {Object} ws - WebSocket instance
 * @param {Object} message - Message object
 * @param {ConnectionState} state - Connection state
 */
async function handleCodeGeneration(ws, message, state) {
  const connectionInfo = state.getConnectionInfo();
  const repoId = message.repoId || connectionInfo?.repoId;
  const userName = message.userName || connectionInfo?.userName;
  const branch = message.branch || connectionInfo?.branch;

  console.log(`Generating code for repo: ${repoId}, branch: ${branch}`);

  if (!repoId || !userName || !branch) {
    console.error('Missing connection info for code generation');
    sendError(ws, 'Missing connection info for code generation');
    return;
  }

  try {
    const conversations = await getRecentTranscriptionsForBranch(repoId, branch, 60);

    if (conversations.length === 0) {
      console.log('No conversations found in the last 60 minutes');
      sendCodeGenerationResult(ws, {
        summary: 'No conversations found in the last 60 minutes. Please have some conversations first.',
        files: []
      });
      return;
    }

    console.log(`Found ${conversations.length} conversation messages from all users`);

    const result = await generateCode(repoId, branch, conversations);
    const audioBuffer = await generateAudioFromSummary(result.summary);
    sendCodeGenerationResult(ws, result, audioBuffer);
  } catch (error) {
    console.error('Error in code generation process:', error);
    sendCodeGenerationResult(ws, {
      summary: `Error: ${error.message}`,
      files: []
    });
  }
}

/**
 * Handle ping message
 * @param {Object} ws - WebSocket instance
 */
function handlePing(ws) {
  sendMessage(ws, { type: 'pong' });
}

/**
 * Route control messages to appropriate handlers
 * @param {Object} ws - WebSocket instance
 * @param {Object} message - Parsed message object
 * @param {ConnectionState} state - Connection state
 */
async function routeControlMessage(ws, message, state) {
  console.log('Received control message:', message.type);

  switch (message.type) {
    case 'start':
      await handleStartRecognition(ws, message, state);
      break;

    case 'stop':
      handleStopRecognition(ws, state);
      break;

    case 'ping':
      handlePing(ws);
      break;

    case 'generate_code':
      await handleCodeGeneration(ws, message, state);
      break;

    default:
      sendError(ws, `Unknown message type: ${message.type}`);
  }
}

/**
 * Handle incoming WebSocket message
 * @param {Object} ws - WebSocket instance
 * @param {Object} parsedMessage - Parsed message with type and data
 * @param {ConnectionState} state - Connection state
 */
export async function handleMessage(ws, parsedMessage, state) {
  try {
    if (parsedMessage.type === 'json') {
      await routeControlMessage(ws, parsedMessage.data, state);
    } else if (parsedMessage.type === 'audio') {
      handleAudioData(ws, parsedMessage.data, state);
    } else {
      console.warn('Unknown message type:', parsedMessage.type);
      sendError(ws, 'Invalid message format');
    }
  } catch (error) {
    console.error('Error routing message:', error);
    sendError(ws, error.message);
  }
}

