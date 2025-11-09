import mic = require('mic');
import WebSocket = require('ws');
import { handleWebSocketMessage, MessageCallbacks } from './websocket/messageHandler';

const MIC_CONFIG = {
    rate: '16000',
    channels: '1',
    debug: true,
    exitOnSilence: 0,
    device: 'default'
} as const;

const AUDIO_CONFIG = {
    encoding: 'LINEAR16',
    sampleRate: 16000,
    languageCode: 'en-US'
} as const;

export class AudioRecorder {
    private micInstance: mic.Microphone | null = null;
    private micInputStream: NodeJS.ReadableStream | null = null;
    private ws: WebSocket | null = null;
    private isRecording: boolean = false;
    private connectionInfo: any = null;
    private callbacks: MessageCallbacks = {};

    constructor() {}

    async startRecording(wsUrl: string, connectionInfo: any): Promise<void> {
        if (this.isRecording) {
            throw new Error('Already recording');
        }

        this.connectionInfo = connectionInfo;

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.connectWebSocket(wsUrl);
        }

        this.setupMicrophone();
        this.sendStartCommand(connectionInfo);
        this.setupAudioStream();
        
        this.micInstance!.start();
        this.isRecording = true;
    }

    private setupMicrophone(): void {
        const micInstance = mic(MIC_CONFIG);
        this.micInstance = micInstance;
        this.micInputStream = micInstance.getAudioStream();
    }

    private sendStartCommand(connectionInfo: any): void {
        if (this.isWebSocketReady()) {
            this.ws!.send(JSON.stringify({
                type: 'start',
                repoId: connectionInfo.repoId,
                userName: connectionInfo.userName,
                branch: connectionInfo.branch,
                ...AUDIO_CONFIG
            }));
        }
    }

    private setupAudioStream(): void {
        if (!this.micInputStream) return;

        this.micInputStream.on('data', (data: Buffer) => {
            if (this.isWebSocketReady() && data.length > 0) {
                this.ws!.send(data);
            }
        });

        this.micInputStream.on('error', (err: Error) => {
            console.error('Microphone stream error:', err);
        });
    }

    private isWebSocketReady(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    stopRecording(): void {
        if (!this.isRecording) {
            return;
        }

        this.stopMicrophone();
        this.sendStopCommand();
        this.isRecording = false;
    }

    private stopMicrophone(): void {
        if (this.micInstance) {
            this.micInstance.stop();
            this.micInstance = null;
        }

        if (this.micInputStream) {
            this.micInputStream.removeAllListeners();
            this.micInputStream = null;
        }
    }

    private sendStopCommand(): void {
        if (this.isWebSocketReady()) {
            this.ws!.send(JSON.stringify({ type: 'stop' }));
        }
    }

    private disconnectCallback: (() => void) | null = null;

    setDisconnectCallback(callback: () => void): void {
        this.disconnectCallback = callback;
    }

    private connectWebSocket(wsUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.closeExistingConnection();

            this.ws = new WebSocket(wsUrl);
            this.setupWebSocketHandlers(resolve, reject);
        });
    }

    private closeExistingConnection(): void {
        if (this.ws) {
            this.ws.removeAllListeners();
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            this.ws = null;
        }
    }

    private setupWebSocketHandlers(resolve: () => void, reject: (error: Error) => void): void {
        if (!this.ws) return;

        this.ws.on('open', () => {
            console.log('Audio recorder WebSocket connected');
            resolve();
        });

        this.ws.on('error', (error: Error) => {
            console.error('Audio recorder WebSocket error:', error);
            reject(error);
        });

        this.ws.on('close', () => {
            console.log('Audio recorder WebSocket disconnected');
            if (this.isRecording) {
                this.stopRecording();
            }
            if (this.disconnectCallback) {
                this.disconnectCallback();
            }
            this.ws = null;
        });

        this.ws.on('message', (data: WebSocket.Data) => {
            handleWebSocketMessage(data, this.callbacks);
        });
    }

    getRecordingState(): boolean {
        return this.isRecording;
    }

    /**
     * Ensure WebSocket is connected. If not connected, connects using the stored connection info.
     */
    async ensureConnected(wsUrl: string): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.connectWebSocket(wsUrl);
        }
    }

    /**
     * Send a message through the WebSocket connection
     * @param message - The message object to send
     * @param wsUrl - WebSocket URL (used if connection needs to be established)
     */
    async sendMessage(message: any, wsUrl: string): Promise<void> {
        await this.ensureConnected(wsUrl);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            throw new Error('WebSocket is not connected');
        }
    }

    disconnect(): void {
        this.stopRecording();
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.ws = null;
        }
    }

    dispose(): void {
        this.disconnect();
    }

    setTranscriptionCallback(callback: (transcript: string, isFinal: boolean) => void): void {
        this.callbacks.transcription = callback;
    }

    setCodeGenerationCallback(callback: (result: any) => void): void {
        this.callbacks.codeGeneration = callback;
    }

    setAudioPlaybackCallback(callback: (audioData: string, format: string) => void): void {
        this.callbacks.audioPlayback = callback;
    }
}

