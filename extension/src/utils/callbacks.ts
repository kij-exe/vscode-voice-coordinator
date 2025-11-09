import * as vscode from 'vscode';
import { sendToWebview } from './webviewMessages';

/**
 * Create transcription callback
 * @param getPanel - Function to get current webview panel
 * @returns Callback function
 */
export function createTranscriptionCallback(getPanel: () => vscode.WebviewPanel | undefined) {
    return (transcript: string, isFinal: boolean) => {
        sendToWebview(getPanel(), {
            type: 'transcription',
            transcript,
            isFinal
        });
    };
}

/**
 * Create disconnect callback
 * @param panel - Webview panel (function to get current panel)
 * @param setConnectionInfo - Function to set connection info to null
 * @returns Callback function
 */
export function createDisconnectCallback(
    getPanel: () => vscode.WebviewPanel | undefined,
    setConnectionInfo: (info: any) => void
) {
    return () => {
        setConnectionInfo(null);
        sendToWebview(getPanel(), {
            type: 'disconnected',
            message: 'Connection to backend lost'
        });
        vscode.window.showWarningMessage('Connection to backend server lost. Please reconnect.');
    };
}

/**
 * Create code generation callback
 * @param getPanel - Function to get current webview panel
 * @param savePatches - Function to save patches
 * @param playAudio - Function to play audio
 * @returns Callback function and pending audio setter
 */
export function createCodeGenerationCallback(
    getPanel: () => vscode.WebviewPanel | undefined,
    savePatches: (result: any) => Promise<void>,
    playAudio: (data: string, format: string) => void
) {
    let pendingAudio: { data: string; format: string } | null = null;

    return {
        callback: async (result: any) => {
            sendToWebview(getPanel(), {
                type: 'code_generation_result',
                result: result
            });
            await savePatches(result);
            if (pendingAudio) {
                playAudio(pendingAudio.data, pendingAudio.format);
                pendingAudio = null;
            }
        },
        setPendingAudio: (data: string, format: string) => {
            pendingAudio = { data, format };
        }
    };
}

/**
 * Create audio playback callback
 * @param setPendingAudio - Function to set pending audio
 * @returns Callback function
 */
export function createAudioPlaybackCallback(
    setPendingAudio: (data: string, format: string) => void
) {
    return (audioData: string, format: string) => {
        setPendingAudio(audioData, format);
    };
}

