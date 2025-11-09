import WebSocket = require('ws');

export interface MessageCallbacks {
    transcription?: (transcript: string, isFinal: boolean) => void;
    codeGeneration?: (result: any) => void;
    audioPlayback?: (audioData: string, format: string) => void;
}

/**
 * Handle WebSocket message
 * @param data - Message data
 * @param callbacks - Callback functions
 */
export function handleWebSocketMessage(data: WebSocket.Data, callbacks: MessageCallbacks): void {
    try {
        const message = JSON.parse(data.toString());
        console.log(message);

        switch (message.type) {
            case 'transcription':
                if (callbacks.transcription) {
                    callbacks.transcription(message.transcript, message.isFinal);
                }
                break;

            case 'code_generation_result':
                console.log('\n=== Code Generation Result from Server ===');
                console.log(JSON.stringify(message.result, null, 2));
                if (callbacks.codeGeneration) {
                    callbacks.codeGeneration(message.result);
                }
                if (message.audio && callbacks.audioPlayback) {
                    callbacks.audioPlayback(message.audio, message.audioFormat || 'mp3');
                }
                break;

            case 'code_generation_error':
                console.error('\n=== Code Generation Error ===');
                console.error(message.error);
                break;
        }
    } catch (e) {
        // Binary data or non-JSON, ignore
    }
}

