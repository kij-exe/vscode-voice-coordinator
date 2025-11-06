import textToSpeech from '@google-cloud/text-to-speech';

// Initialize Google Text-to-Speech client
let textToSpeechClient = null;
try {
  textToSpeechClient = new textToSpeech.TextToSpeechClient();
  console.log('Google Text-to-Speech client initialized successfully');
} catch (error) {
  console.warn('Google Text-to-Speech client not initialized. Set GOOGLE_APPLICATION_CREDENTIALS.');
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

  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  try {
    // Limit text length to avoid very long audio files (max ~5000 characters)
    const maxLength = 5000;
    const truncatedText = text.length > maxLength 
      ? text.substring(0, maxLength) + '...' 
      : text;

    const request = {
      input: { text: truncatedText },
      voice: {
        languageCode: languageCode,
        name: voiceName,
        ssmlGender: 'NEUTRAL'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0
      }
    };

    console.log(`Synthesizing speech for text (${truncatedText.length} chars)...`);

    const [response] = await textToSpeechClient.synthesizeSpeech(request);
    
    if (response.audioContent) {
      return Buffer.from(response.audioContent, 'base64');
    } else {
      throw new Error('No audio content received from Text-to-Speech service');
    }
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    throw error;
  }
}

/**
 * Check if Text-to-Speech service is available
 * @returns {boolean}
 */
export function isTextToSpeechAvailable() {
  return textToSpeechClient !== null;
}

