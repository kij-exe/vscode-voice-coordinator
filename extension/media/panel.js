const vscode = acquireVsCodeApi();

let isConnected = false;
let isRecording = false;
let connectionInfo = null;
let httpUrl = '';

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

function showStatus(elementId, message, type = '') {
    const element = document.getElementById(elementId);
    element.innerHTML = '<div class="status ' + type + '">' + message + '</div>';
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
            break;
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const connectButton = document.getElementById('connectBtn');
    const speechButton = document.getElementById('speechBtn');

    if (connectButton) {
        connectButton.addEventListener('click', connect);
    }
    
    if (speechButton) {
        speechButton.addEventListener('click', toggleSpeech);
    }
});

