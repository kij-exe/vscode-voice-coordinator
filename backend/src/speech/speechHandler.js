import speech from '@google-cloud/speech';
import { putTranscription } from '../storage/storage.js';

// Initialize Google Speech-to-Text client
let speechClient = null;
try {
  speechClient = new speech.SpeechClient();
  console.log('Google Speech-to-Text client initialized successfully');
} catch (error) {
  console.warn('Google Speech-to-Text client not initialized. Set GOOGLE_APPLICATION_CREDENTIALS.');
}

/**
 * Create a recognition stream for audio transcription
 * @param {Object} config - Recognition configuration
 * @param {string} config.encoding - Audio encoding (e.g., 'LINEAR16')
 * @param {number} config.sampleRate - Sample rate in Hz (e.g., 16000)
 * @param {string} config.languageCode - Language code (e.g., 'en-US')
 * @param {Object} connectionInfo - Connection information
 * @param {Function} onTranscription - Callback for transcriptions (transcript, isFinal)
 * @returns {Object} Recognition stream with write and end methods
 */
export function createRecognitionStream(config, connectionInfo, onTranscription) {
  if (!speechClient) {
    throw new Error('Speech-to-Text service not available. Set GOOGLE_APPLICATION_CREDENTIALS.');
  }

  const request = {
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

  console.log(`Creating recognition stream for:`, {
    repoId: connectionInfo.repoId,
    userName: connectionInfo.userName,
    branch: connectionInfo.branch,
    encoding: config.encoding,
    sampleRate: config.sampleRate,
    languageCode: config.languageCode
  });

  const recognizeStream = speechClient
    .streamingRecognize(request)
    .on('error', (error) => {
      console.error(`Recognition error:`, error.message || error);
      if (onTranscription) {
        onTranscription(null, false, error);
      }
    })
    .on('data', async (data) => {
      const result = data.results[0];
      if (result && result.alternatives[0]) {
        const transcript = result.alternatives[0].transcript;
        const isFinal = result.isFinal;

        // Print to console
        console.log(`[${isFinal ? 'FINAL' : 'INTERIM'}] Transcription: ${transcript}`);

        // Call callback if provided
        if (onTranscription) {
          onTranscription(transcript, isFinal, null);
        }

        // Save final transcripts
        if (isFinal && connectionInfo && transcript.trim()) {
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
      }
    });

  return recognizeStream;
}

/**
 * Check if Speech-to-Text service is available
 * @returns {boolean}
 */
export function isSpeechClientAvailable() {
  return speechClient !== null;
}

