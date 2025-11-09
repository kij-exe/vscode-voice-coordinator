import textToSpeech from '@google-cloud/text-to-speech';

// Constants
const MAX_TEXT_LENGTH = 5000;

// Initialize Google Text-to-Speech client
let textToSpeechClient = null;
try {
  textToSpeechClient = new textToSpeech.TextToSpeechClient();
  console.log('Google Text-to-Speech client initialized successfully');
} catch (error) {
  console.warn('Google Text-to-Speech client not initialized. Set GOOGLE_APPLICATION_CREDENTIALS.');
}

/**
 * Validate text input
 * @param {string} text - Text to validate
 * @throws {Error} If text is empty or invalid
 */
function validateText(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }
}

/**
 * Truncate text to maximum length if necessary
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default: MAX_TEXT_LENGTH)
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = MAX_TEXT_LENGTH) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '...';
  }
  return text;
}

/**
 * Create synthesis request for Text-to-Speech API
 * @param {string} text - Text to synthesize
 * @param {string} languageCode - Language code
 * @param {string} voiceName - Voice name
 * @returns {Object} Synthesis request object
 */
function createSynthesisRequest(text, languageCode, voiceName) {
  return {
    input: { text },
    voice: {
      languageCode,
      name: voiceName,
      ssmlGender: 'NEUTRAL'
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
      pitch: 0.0
    }
  };
}

/**
 * Process audio response from Text-to-Speech API
 * @param {Object} response - API response
 * @returns {Buffer} Audio buffer
 * @throws {Error} If no audio content is received
 */
function processAudioResponse(response) {
  if (!response.audioContent) {
    throw new Error('No audio content received from Text-to-Speech service');
  }
  return Buffer.from(response.audioContent, 'base64');
}

/**
 * Convert text to speech and return audio buffer
 * @param {string} text - Text to convert to speech
 * @param {string} languageCode - Language code (default: 'en-US')
 * @param {string} voiceName - Voice name (default: 'en-US-Standard-D')
 * @returns {Promise<Buffer>} Audio buffer
 */
export async function synthesizeSpeech(text, languageCode = 'en-US', voiceName = 'en-US-Standard-D') {
  if (!textToSpeechClient) {
    throw new Error('Text-to-Speech service not available. Set GOOGLE_APPLICATION_CREDENTIALS.');
  }

  validateText(text);

  const truncatedText = truncateText(text);
  const request = createSynthesisRequest(truncatedText, languageCode, voiceName);

  console.log(`Synthesizing speech for text (${truncatedText.length} chars)...`);

  const [response] = await textToSpeechClient.synthesizeSpeech(request);
  return processAudioResponse(response);
}

/**
 * Check if Text-to-Speech service is available
 * @returns {boolean}
 */
export function isTextToSpeechAvailable() {
  return textToSpeechClient !== null;
}

