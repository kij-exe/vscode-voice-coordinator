import speech from '@google-cloud/speech';
import { putTranscription } from '../db/database.js';

// Initialize Google Speech-to-Text client
let speechClient = null;
try {
  speechClient = new speech.SpeechClient();
  console.log('Google Speech-to-Text client initialized successfully');
} catch (error) {
  console.warn('Google Speech-to-Text client not initialized. Set GOOGLE_APPLICATION_CREDENTIALS.');
}

/**
 * Create recognition request configuration
 * @param {Object} config - Recognition configuration
 * @param {string} config.encoding - Audio encoding (e.g., 'LINEAR16')
 * @param {number} config.sampleRate - Sample rate in Hz (e.g., 16000)
 * @param {string} config.languageCode - Language code (e.g., 'en-US')
 * @returns {Object} Recognition request object
 */
function createRecognitionRequest(config) {
  return {
    config: {
      encoding: config.encoding || 'LINEAR16',
      sampleRateHertz: config.sampleRate || 16000,
      languageCode: config.languageCode || 'en-US',
      enableAutomaticPunctuation: true,
      model: 'default',
      useEnhanced: true
    },
    interimResults: true,
    singleUtterance: false
  };
}

/**
 * Handle recognition stream errors
 * @param {Error} error - Error object
 * @param {Function} onTranscription - Callback for transcriptions
 */
function handleRecognitionError(error, onTranscription) {
  console.error('Recognition error:', error.message || error);
  if (onTranscription) {
    onTranscription(null, false, error);
  }
}

/**
 * Save transcription to database
 * @param {Object} connectionInfo - Connection information
 * @param {string} transcript - Transcription text
 */
async function saveTranscription(connectionInfo, transcript) {
  if (!connectionInfo || !transcript.trim()) {
    return;
  }

  try {
    await putTranscription(
      connectionInfo.repoId,
      connectionInfo.userName,
      connectionInfo.branch,
      transcript,
      new Date().toISOString()
    );
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
}

/**
 * Handle recognition stream data events
 * @param {Object} data - Recognition data from stream
 * @param {Object} connectionInfo - Connection information
 * @param {Function} onTranscription - Callback for transcriptions
 */
async function handleRecognitionData(data, connectionInfo, onTranscription) {
  const result = data.results[0];
  if (!result?.alternatives[0]) {
    return;
  }

  const transcript = result.alternatives[0].transcript;
  const isFinal = result.isFinal;

  if (isFinal) {
    console.log('[FINAL] Transcription:', transcript);
  }

  if (onTranscription) {
    onTranscription(transcript, isFinal, null);
  }

  if (isFinal) {
    await saveTranscription(connectionInfo, transcript);
  }
}

/**
 * Create a recognition stream for audio transcription
 * @param {Object} config - Recognition configuration
 * @param {string} config.encoding - Audio encoding (e.g., 'LINEAR16')
 * @param {number} config.sampleRate - Sample rate in Hz (e.g., 16000)
 * @param {string} config.languageCode - Language code (e.g., 'en-US')
 * @param {Object} connectionInfo - Connection information
 * @param {Function} onTranscription - Callback for transcriptions (transcript, isFinal, error)
 * @returns {Object} Recognition stream with write and end methods
 */
export function createRecognitionStream(config, connectionInfo, onTranscription) {
  if (!speechClient) {
    throw new Error('Speech-to-Text service not available. Set GOOGLE_APPLICATION_CREDENTIALS.');
  }

  const request = createRecognitionRequest(config);

  console.log('Creating recognition stream for:', {
    repoId: connectionInfo.repoId,
    userName: connectionInfo.userName,
    branch: connectionInfo.branch,
    encoding: config.encoding,
    sampleRate: config.sampleRate,
    languageCode: config.languageCode
  });

  const recognizeStream = speechClient
    .streamingRecognize(request)
    .on('error', (error) => handleRecognitionError(error, onTranscription))
    .on('data', (data) => handleRecognitionData(data, connectionInfo, onTranscription));

  return recognizeStream;
}

/**
 * Check if Speech-to-Text service is available
 * @returns {boolean}
 */
export function isSpeechClientAvailable() {
  return speechClient !== null;
}

