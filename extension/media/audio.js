/**
 * Audio playback and unlocking utilities
 */

let audioContext = null;
let audioUnlocked = false;

/**
 * Unlock audio during user gesture using Web Audio API
 */
export function unlockAudio() {
    if (audioUnlocked) {
        return;
    }

    try {
        // Create AudioContext during user gesture to unlock audio
        if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
            const AudioContextClass = AudioContext || webkitAudioContext;
            audioContext = new AudioContextClass();
            
            // Create a silent buffer and play it to unlock audio
            const buffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
            source.stop(0.001);
            
            audioUnlocked = true;
            console.log('Audio unlocked using Web Audio API');
        } else {
            // Fallback: try HTML5 Audio
            unlockAudioWithHTML5();
        }
    } catch (e) {
        console.warn('Error unlocking audio:', e);
        unlockAudioWithHTML5();
    }
}

/**
 * Unlock audio using HTML5 Audio fallback
 */
function unlockAudioWithHTML5() {
    try {
        const unlockAudio = new Audio();
        unlockAudio.volume = 0.01;
        unlockAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        const playPromise = unlockAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                unlockAudio.pause();
                unlockAudio.currentTime = 0;
                audioUnlocked = true;
                console.log('Audio unlocked using HTML5 Audio');
            }).catch(() => {
                console.warn('Could not unlock audio, will attempt playback anyway');
            });
        }
    } catch (e) {
        console.warn('Error unlocking audio with HTML5:', e);
    }
}

/**
 * Convert base64 string to ArrayBuffer
 * @param {string} base64Data - Base64 encoded data
 * @returns {ArrayBuffer} ArrayBuffer
 */
function base64ToArrayBuffer(base64Data) {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Convert base64 string to Blob
 * @param {string} base64Data - Base64 encoded data
 * @param {string} mimeType - MIME type
 * @returns {Blob} Blob object
 */
function base64ToBlob(base64Data, mimeType) {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
}

/**
 * Get or create AudioContext
 * @returns {AudioContext|null} AudioContext instance
 */
function getAudioContext() {
    if (!audioContext) {
        const AudioContextClass = AudioContext || webkitAudioContext;
        if (AudioContextClass) {
            audioContext = new AudioContextClass();
        }
    }
    return audioContext;
}

/**
 * Play audio using Web Audio API
 * @param {string} base64Data - Base64 encoded audio data
 * @param {string} format - Audio format (e.g., 'mp3')
 */
export function playAudioWithWebAudio(base64Data, format) {
    try {
        console.log('Playing audio with Web Audio API');
        
        const context = getAudioContext();
        if (!context) {
            throw new Error('AudioContext not available');
        }

        const arrayBuffer = base64ToArrayBuffer(base64Data);
        
        context.decodeAudioData(arrayBuffer).then(audioBuffer => {
            const source = context.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(context.destination);
            source.start(0);
            console.log('Audio playback started with Web Audio API');
            
            source.onended = () => {
                console.log('Web Audio playback ended');
            };
        }).catch(error => {
            console.warn('Error decoding audio with Web Audio API, falling back to HTML5:', error);
            playAudioWithHTML5(base64Data, format);
        });
    } catch (error) {
        console.warn('Error with Web Audio API, falling back to HTML5:', error);
        playAudioWithHTML5(base64Data, format);
    }
}

/**
 * Play audio using HTML5 Audio
 * @param {string} base64Data - Base64 encoded audio data
 * @param {string} format - Audio format (e.g., 'mp3')
 */
export function playAudioWithHTML5(base64Data, format) {
    try {
        console.log('Playing audio with HTML5 Audio');
        
        const mimeType = format === 'mp3' ? 'audio/mpeg' : `audio/${format}`;
        const blob = base64ToBlob(base64Data, mimeType);
        const blobUrl = URL.createObjectURL(blob);
        
        const audio = new Audio();
        let played = false;
        
        const playAudio = () => {
            if (played) return;
            played = true;
            
            console.log('Attempting to play audio with HTML5...');
            audio.volume = 1.0;
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('HTML5 Audio playback started successfully');
                }).catch(error => {
                    if (error.name !== 'NotAllowedError') {
                        console.warn('Error playing HTML5 audio:', error);
                    } else {
                        console.log('HTML5 Audio playback blocked - user gesture required');
                    }
                    URL.revokeObjectURL(blobUrl);
                });
            }
        };
        
        audio.addEventListener('loadeddata', playAudio);
        audio.addEventListener('canplay', playAudio);
        audio.addEventListener('canplaythrough', playAudio);
        audio.addEventListener('ended', () => {
            console.log('HTML5 Audio playback ended');
            URL.revokeObjectURL(blobUrl);
        });
        audio.addEventListener('error', () => {
            console.warn('HTML5 Audio element error:', audio.error);
            URL.revokeObjectURL(blobUrl);
        });
        
        audio.src = blobUrl;
        
        // Fallback timeout
        setTimeout(() => {
            if (!played) {
                playAudio();
            }
        }, 500);
    } catch (error) {
        console.warn('Error with HTML5 Audio playback:', error);
    }
}

/**
 * Play audio (tries Web Audio API first, falls back to HTML5)
 * @param {string} base64Data - Base64 encoded audio data
 * @param {string} format - Audio format (e.g., 'mp3')
 */
export function playAudio(base64Data, format) {
    const context = getAudioContext();
    
    if (context && context.state === 'suspended') {
        context.resume().then(() => {
            console.log('AudioContext resumed');
            playAudioWithWebAudio(base64Data, format);
        }).catch(err => {
            console.warn('Could not resume AudioContext, trying HTML5 Audio:', err);
            playAudioWithHTML5(base64Data, format);
        });
    } else if (context) {
        playAudioWithWebAudio(base64Data, format);
    } else {
        playAudioWithHTML5(base64Data, format);
    }
}

