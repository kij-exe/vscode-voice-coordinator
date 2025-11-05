import mic = require('mic');
import WebSocket = require('ws');

export class AudioRecorder {
    private micInstance: mic.Microphone | null = null;
    private micInputStream: NodeJS.ReadableStream | null = null;
    private ws: WebSocket | null = null;
    private isRecording: boolean = false;
    private connectionInfo: any = null;
    private transcriptionCallback: ((transcript: string, isFinal: boolean) => void) | null = null;

    constructor() {}

    async startRecording(wsUrl: string, connectionInfo: any): Promise<void> {
        if (this.isRecording) {
            throw new Error('Already recording');
        }

        this.connectionInfo = connectionInfo;

        // Connect WebSocket if not already connected
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.connectWebSocket(wsUrl);
        }

        // Configure microphone
        const micInstance = mic({
            rate: '16000',
            channels: '1',
            debug: true,
            exitOnSilence: 0,
            device: 'default'
        });

        this.micInstance = micInstance;
        this.micInputStream = micInstance.getAudioStream();

        // Send start command to backend
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'start',
                repoId: connectionInfo.repoId,
                userName: connectionInfo.userName,
                branch: connectionInfo.branch,
                encoding: 'LINEAR16',
                sampleRate: 16000,
                languageCode: 'en-US'
            }));
        }

        // Stream audio data to WebSocket
        if (this.micInputStream) {
            this.micInputStream.on('data', (data: Buffer) => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN && data.length > 0) {
                    this.ws.send(data);
                }
            });

            this.micInputStream.on('error', (err: Error) => {
                console.error('Microphone stream error:', err);
            });
        }

        micInstance.start();
        this.isRecording = true;
    }

    stopRecording(): void {
        if (!this.isRecording) {
            return;
        }

        if (this.micInstance) {
            this.micInstance.stop();
            this.micInstance = null;
        }

        if (this.micInputStream) {
            this.micInputStream.removeAllListeners();
            this.micInputStream = null;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'stop' }));
        }

        this.isRecording = false;
    }

    private disconnectCallback: (() => void) | null = null;

    setDisconnectCallback(callback: () => void): void {
        this.disconnectCallback = callback;
    }

    private connectWebSocket(wsUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Close existing connection if any
            if (this.ws) {
                this.ws.removeAllListeners();
                if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                    this.ws.close();
                }
                this.ws = null;
            }

            this.ws = new WebSocket(wsUrl);

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
                // If recording, stop it
                if (this.isRecording) {
                    this.stopRecording();
                }
                // Notify about disconnection
                if (this.disconnectCallback) {
                    this.disconnectCallback();
                }
                this.ws = null;
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                // Handle backend messages (transcriptions, etc.)
                try {
                    const message = JSON.parse(data.toString());
                    console.log(message);
                    if (message.type === 'transcription' && this.transcriptionCallback) {
                        this.transcriptionCallback(message.transcript, message.isFinal);
                    }
                } catch (e) {
                    // Binary data or non-JSON, ignore
                }
            });
        });
    }

    getRecordingState(): boolean {
        return this.isRecording;
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
        this.transcriptionCallback = callback;
        // If WebSocket already exists, update its message handler
        if (this.ws) {
            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'transcription' && this.transcriptionCallback) {
                        this.transcriptionCallback(message.transcript, message.isFinal);
                    }
                } catch (e) {
                    // Binary data or non-JSON, ignore
                }
            });
        }
    }
}

