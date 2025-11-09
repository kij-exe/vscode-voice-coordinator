/**
 * UI state management and DOM updates
 */

/**
 * Show status message in an element
 * @param {string} elementId - ID of the element to update
 * @param {string} message - Status message
 * @param {string} type - Status type ('' for normal, 'error', 'connected')
 */
export function showStatus(elementId, message, type = '') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="status ' + type + '">' + message + '</div>';
    }
}

/**
 * Update connection UI state
 * @param {boolean} connected - Whether connected
 */
export function updateConnectionState(connected) {
    const speechBtn = document.getElementById('speechBtn');
    const generateCodeBtn = document.getElementById('generateCodeBtn');
    
    if (speechBtn) {
        speechBtn.disabled = !connected;
    }
    if (generateCodeBtn) {
        generateCodeBtn.disabled = !connected;
    }
}

/**
 * Update recording UI state
 * @param {boolean} recording - Whether recording
 */
export function updateRecordingState(recording) {
    const speechBtn = document.getElementById('speechBtn');
    if (speechBtn) {
        speechBtn.textContent = recording 
            ? 'Stop Speech Recognition' 
            : 'Start Speech Recognition';
    }
}

/**
 * Add transcription to the transcription area
 * @param {string} transcript - Transcription text
 * @param {boolean} isFinal - Whether the transcription is final
 */
export function addTranscription(transcript, isFinal) {
    const area = document.getElementById('transcriptionArea');
    if (!area) return;
    
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

/**
 * Show loading animation
 * @param {boolean} show - Whether to show the animation
 */
export function showLoadingAnimation(show) {
    const loadingAnimation = document.getElementById('loadingAnimation');
    if (loadingAnimation) {
        loadingAnimation.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Enable/disable generate code button
 * @param {boolean} enabled - Whether to enable the button
 */
export function setGenerateCodeButtonEnabled(enabled) {
    const button = document.getElementById('generateCodeBtn');
    if (button) {
        button.disabled = !enabled;
    }
}

/**
 * Handle code generation result display
 * @param {number} count - Number of patches saved
 * @param {string} summary - Result summary
 */
export function handleCodeGenerationResult(count, summary) {
    showLoadingAnimation(false);
    setGenerateCodeButtonEnabled(true);
    
    const isError = summary.toLowerCase().includes('error') || summary.toLowerCase().includes('failed');
    
    if (count > 0) {
        showStatus('codeGenStatus', `Code generation complete. ${count} patch file(s) saved to patches/ directory.`, 'connected');
    } else if (isError) {
        showStatus('codeGenStatus', summary || 'Code generation failed.', 'error');
    } else {
        showStatus('codeGenStatus', summary || 'Code generation complete, but no patches were saved.', 'connected');
    }
}

