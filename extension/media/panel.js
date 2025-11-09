import { unlockAudio, playAudio } from './audio.js';
import { 
    showStatus, 
    updateConnectionState, 
    updateRecordingState, 
    addTranscription,
    showLoadingAnimation,
    setGenerateCodeButtonEnabled,
    handleCodeGenerationResult
} from './ui.js';

const vscode = acquireVsCodeApi();

let isConnected = false;
let isRecording = false;
let connectionInfo = null;
let httpUrl = '';

/**
 * Initialize URLs from window configuration
 * @param {string} backendUrl - Backend URL
 */
function initializeUrls(backendUrl) {
    httpUrl = backendUrl.replace(/^ws/, 'http');
}

/**
 * Connect to repository
 */
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
        if (isRecording) {
            vscode.postMessage({ command: 'stopRecording' });
        }
        updateConnectionState(false);
        showStatus('connectionStatus', 'Reconnecting...', '');
    }

    try {
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
        updateConnectionState(true);
        
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

/**
 * Toggle speech recognition
 */
function toggleSpeech() {
    if (isRecording) {
        vscode.postMessage({ command: 'stopRecording' });
    } else {
        vscode.postMessage({ command: 'startRecording' });
    }
}

/**
 * Generate code
 */
async function generateCode() {
    if (!isConnected || !connectionInfo) {
        showStatus('codeGenStatus', 'Not connected to repository', 'error');
        return;
    }

    unlockAudio();

    showStatus('codeGenStatus', '', '');
    setGenerateCodeButtonEnabled(false);
    showLoadingAnimation(true);

    vscode.postMessage({ 
        command: 'generateCode',
        connectionInfo: connectionInfo
    });
}

/**
 * Handle message from extension
 * @param {MessageEvent} event - Message event
 */
function handleMessage(event) {
    const message = event.data;
    
    switch (message.type) {
        case 'connected':
            isConnected = true;
            showStatus('connectionStatus', 'Connected successfully!', 'connected');
            updateConnectionState(true);
            break;

        case 'error':
            showStatus('connectionStatus', message.message, 'error');
            break;

        case 'transcription':
            addTranscription(message.transcript, message.isFinal);
            break;

        case 'initialize':
            initializeUrls(message.backendUrl);
            break;

        case 'recordingStarted':
            isRecording = true;
            updateRecordingState(true);
            showStatus('speechStatus', 'Recording...', '');
            break;

        case 'recordingStopped':
            isRecording = false;
            updateRecordingState(false);
            showStatus('speechStatus', 'Stopped', '');
            break;

        case 'recordingError':
            isRecording = false;
            updateRecordingState(false);
            showStatus('speechStatus', 'Error: ' + message.message, 'error');
            break;

        case 'codeGenStarted':
            showStatus('codeGenStatus', '', '');
            window.lastCodeGenResult = null;
            showLoadingAnimation(true);
            break;

        case 'code_generation_result':
            if (message.result) {
                window.lastCodeGenResult = message.result;
            }
            break;

        case 'patchesSaved':
            const resultSummary = window.lastCodeGenResult?.summary || '';
            handleCodeGenerationResult(message.count, resultSummary);
            break;

        case 'playAudio':
            if (!message.audioData) {
                console.warn('No audio data received');
                break;
            }
            console.log('Received audio data, length:', message.audioData.length);
            try {
                playAudio(message.audioData, message.format);
            } catch (error) {
                console.warn('Error setting up audio playback:', error);
            }
            break;

        case 'codeGenError':
            showStatus('codeGenStatus', 'Error: ' + message.message, 'error');
            showLoadingAnimation(false);
            setGenerateCodeButtonEnabled(true);
            break;

        case 'disconnected':
            isConnected = false;
            connectionInfo = null;
            if (isRecording) {
                isRecording = false;
                updateRecordingState(false);
                updateConnectionState(false);
                showStatus('speechStatus', 'Recording stopped due to disconnection', 'error');
            }
            showStatus('connectionStatus', message.message || 'Disconnected', 'error');
            updateConnectionState(false);
            break;
    }
}

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
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
}

// Setup message listener
window.addEventListener('message', handleMessage);

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initializeEventListeners);
