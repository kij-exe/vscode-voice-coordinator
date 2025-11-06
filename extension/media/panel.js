const vscode = acquireVsCodeApi();

let isConnected = false;
let isRecording = false;
let connectionInfo = null;
let httpUrl = '';
let audioContext = null;
let audioUnlocked = false;

// Initialize URLs from window configuration
function initializeUrls(backendUrl) {
    httpUrl = backendUrl.replace(/^ws/, 'http');
}

async function connect() {
    const repoUrl = document.getElementById('repoUrl').value;
    const userName = document.getElementById('userName').value;
    const branch = document.getElementById('branch').value || 'main';

    console.log(`${userName} is trying to connect to repo ${repoUrl} on branch ${branch}`);

    if (!repoUrl || !userName) {
        showStatus('connectionStatus', 'Please fill in repository URL and your name', 'error');
        return;
    }

    // Reset connection state if reconnecting
    if (isConnected) {
        isConnected = false;
        connectionInfo = null;
        // Stop recording if active
        if (isRecording) {
            vscode.postMessage({ command: 'stopRecording' });
        }
        document.getElementById('speechBtn').disabled = true;
        showStatus('connectionStatus', 'Reconnecting...', '');
    }

    try {
        // Connect via REST API
        const response = await fetch(httpUrl + '/api/repos/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoUrl, userName, branch })
        });

        if (!response.ok) {
            throw new Error('Failed to connect: ' + response.statusText);
        }

        const data = await response.json();
        connectionInfo = {
            repoId: data.repoId,
            userName: data.userName,
            branch: data.branch
        };
        
        isConnected = true;
        showStatus('connectionStatus', 'Connected successfully!', 'connected');
        document.getElementById('speechBtn').disabled = false;
        document.getElementById('generateCodeBtn').disabled = false;
        
        // Notify extension about connection
        vscode.postMessage({ 
            command: 'connected',
            connectionInfo: connectionInfo
        });
        vscode.postMessage({ command: 'showInfo', text: 'Connected to ' + repoUrl });
    } catch (error) {
        isConnected = false;
        connectionInfo = null;
        showStatus('connectionStatus', error.message, 'error');
        vscode.postMessage({ command: 'showError', text: 'Failed to connect: ' + error.message });
    }
}


async function toggleSpeech() {
    if (isRecording) {
        // Request extension to stop recording
        vscode.postMessage({ command: 'stopRecording' });
    } else {
        // Request extension to start recording
        vscode.postMessage({ command: 'startRecording' });
    }
}

async function generateCode() {
    if (!isConnected || !connectionInfo) {
        showStatus('codeGenStatus', 'Not connected to repository', 'error');
        return;
    }

    // Unlock audio during user gesture (button click) using Web Audio API
    if (!audioUnlocked) {
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
            }
        } catch (e) {
            console.warn('Error unlocking audio:', e);
        }
    }

    showStatus('codeGenStatus', '', '');
    const button = document.getElementById('generateCodeBtn');
    const loadingAnimation = document.getElementById('loadingAnimation');
    
    if (button) {
        button.disabled = true;
    }
    
    if (loadingAnimation) {
        loadingAnimation.style.display = 'flex';
    }

    // Send message to extension which will handle websocket communication
    vscode.postMessage({ 
        command: 'generateCode',
        connectionInfo: connectionInfo
    });
}

function showStatus(elementId, message, type = '') {
    const element = document.getElementById(elementId);
    element.innerHTML = '<div class="status ' + type + '">' + message + '</div>';
}

// Play audio using Web Audio API (bypasses user gesture requirement if context was created during gesture)
function playAudioWithWebAudio(base64Data, format) {
    try {
        console.log('Playing audio with Web Audio API');
        
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Decode audio data
        audioContext.decodeAudioData(bytes.buffer).then(audioBuffer => {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            console.log('Audio playback started with Web Audio API');
            
            // Clean up when done
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

// Fallback: Play audio using HTML5 Audio
function playAudioWithHTML5(base64Data, format) {
    try {
        console.log('Playing audio with HTML5 Audio');
        
        // Convert base64 to blob
        const mimeType = format === 'mp3' ? 'audio/mpeg' : `audio/${format}`;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        
        // Create audio element
        const audio = new Audio();
        let played = false;
        
        const playAudioFunc = () => {
            if (!played) {
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
            }
        };
        
        audio.addEventListener('loadeddata', playAudioFunc);
        audio.addEventListener('canplay', playAudioFunc);
        audio.addEventListener('canplaythrough', playAudioFunc);
        audio.addEventListener('ended', () => {
            console.log('HTML5 Audio playback ended');
            URL.revokeObjectURL(blobUrl);
        });
        audio.addEventListener('error', (e) => {
            console.warn('HTML5 Audio element error:', audio.error);
            URL.revokeObjectURL(blobUrl);
        });
        
        audio.src = blobUrl;
        
        setTimeout(() => {
            if (!played) {
                playAudioFunc();
            }
        }, 500);
    } catch (error) {
        console.warn('Error with HTML5 Audio playback:', error);
    }
}

function addTranscription(transcript, isFinal) {
    const area = document.getElementById('transcriptionArea');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isFinal ? 'final' : 'interim');
    messageDiv.textContent = transcript;
    
    if (isFinal) {
        // Remove any interim messages
        const interimMessages = area.querySelectorAll('.message.interim');
        interimMessages.forEach(msg => msg.remove());
    } else {
        // Remove previous interim message if exists
        const prevInterim = area.querySelector('.message.interim');
        if (prevInterim) {
            prevInterim.remove();
        }
    }
    
    area.appendChild(messageDiv);
    area.scrollTop = area.scrollHeight;
}

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'connected':
            isConnected = true;
            showStatus('connectionStatus', 'Connected successfully!', 'connected');
            document.getElementById('speechBtn').disabled = false;
            document.getElementById('generateCodeBtn').disabled = false;
            break;
        case 'error':
            showStatus('connectionStatus', message.message, 'error');
            break;
        case 'transcription':
            addTranscription(message.transcript, message.isFinal);
            break;
        case 'toggleSpeech':
            toggleSpeech();
            break;
        case 'initialize':
            initializeUrls(message.backendUrl);
            break;
        case 'recordingStarted':
            isRecording = true;
            document.getElementById('speechBtn').textContent = 'Stop Speech Recognition';
            showStatus('speechStatus', 'Recording...', '');
            break;
        case 'recordingStopped':
            isRecording = false;
            document.getElementById('speechBtn').textContent = 'Start Speech Recognition';
            showStatus('speechStatus', 'Stopped', '');
            break;
        case 'recordingError':
            isRecording = false;
            document.getElementById('speechBtn').textContent = 'Start Speech Recognition';
            showStatus('speechStatus', 'Error: ' + message.message, 'error');
            break;
        case 'codeGenStarted':
            showStatus('codeGenStatus', '', '');
            window.lastCodeGenResult = null; // Clear previous result
            const loadingAnimation = document.getElementById('loadingAnimation');
            if (loadingAnimation) {
                loadingAnimation.style.display = 'flex';
            }
            break;
        case 'codeGenComplete':
            // Keep loading animation, wait for patchesSaved message
            break;
        case 'code_generation_result':
            // Store result for later use when patches are saved
            if (message.result) {
                window.lastCodeGenResult = message.result;
            }
            break;
        case 'patchesSaved':
            const loadingAnimationSaved = document.getElementById('loadingAnimation');
            if (loadingAnimationSaved) {
                loadingAnimationSaved.style.display = 'none';
            }
            // Get the result summary if available (stored from code_generation_result)
            const resultSummary = window.lastCodeGenResult?.summary || '';
            const isError = resultSummary.toLowerCase().includes('error') || resultSummary.toLowerCase().includes('failed');
            
            if (message.count > 0) {
                showStatus('codeGenStatus', `Code generation complete. ${message.count} patch file(s) saved to patches/ directory.`, 'connected');
            } else if (isError) {
                // Show error summary
                showStatus('codeGenStatus', resultSummary || 'Code generation failed.', 'error');
            } else {
                showStatus('codeGenStatus', resultSummary || 'Code generation complete, but no patches were saved.', 'connected');
            }
            if (document.getElementById('generateCodeBtn')) {
                document.getElementById('generateCodeBtn').disabled = false;
            }
            break;
        case 'playAudio':
            // Play audio when received
            try {
                if (!message.audioData) {
                    console.warn('No audio data received');
                    break;
                }
                
                console.log('Received audio data, length:', message.audioData.length);
                
                // Ensure AudioContext is available and resumed
                if (!audioContext) {
                    const AudioContextClass = AudioContext || webkitAudioContext;
                    if (AudioContextClass) {
                        audioContext = new AudioContextClass();
                    }
                }
                
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume().then(() => {
                        console.log('AudioContext resumed');
                        playAudioWithWebAudio(message.audioData, message.format);
                    }).catch(err => {
                        console.warn('Could not resume AudioContext, trying HTML5 Audio:', err);
                        playAudioWithHTML5(message.audioData, message.format);
                    });
                } else if (audioContext) {
                    // AudioContext is ready, use Web Audio API
                    playAudioWithWebAudio(message.audioData, message.format);
                } else {
                    // Fallback to HTML5 Audio
                    playAudioWithHTML5(message.audioData, message.format);
                }
            } catch (error) {
                // Silently handle errors - don't break functionality
                console.warn('Error setting up audio playback:', error);
            }
            break;
        case 'codeGenError':
            showStatus('codeGenStatus', 'Error: ' + message.message, 'error');
            const loadingAnimationError = document.getElementById('loadingAnimation');
            if (loadingAnimationError) {
                loadingAnimationError.style.display = 'none';
            }
            if (document.getElementById('generateCodeBtn')) {
                document.getElementById('generateCodeBtn').disabled = false;
            }
            break;
        case 'disconnected':
            isConnected = false;
            connectionInfo = null;
            if (isRecording) {
                isRecording = false;
                document.getElementById('speechBtn').textContent = 'Start Speech Recognition';
                document.getElementById('speechBtn').disabled = true;
                showStatus('speechStatus', 'Recording stopped due to disconnection', 'error');
            }
            showStatus('connectionStatus', message.message || 'Disconnected', 'error');
            document.getElementById('speechBtn').disabled = true;
            document.getElementById('generateCodeBtn').disabled = true;
            break;
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const connectButton = document.getElementById('connectBtn');
    const speechButton = document.getElementById('speechBtn');
    const generateCodeButton = document.getElementById('generateCodeBtn');

    if (connectButton) {
        connectButton.addEventListener('click', connect);
    }
    
    if (speechButton) {
        speechButton.addEventListener('click', toggleSpeech);
    }

    if (generateCodeButton) {
        generateCodeButton.addEventListener('click', generateCode);
    }
});

