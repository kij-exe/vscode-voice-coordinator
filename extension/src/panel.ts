import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AudioRecorder } from './audioRecorder';

export class CoordinatorPanel {
    public static readonly viewType = 'hiyaCoordinator';
    private _panel: vscode.WebviewPanel | undefined;
    private _disposables: vscode.Disposable[] = [];
    private backendUrl: string;
    private wsUrl: string;
    private audioRecorder: AudioRecorder;
    private connectionInfo: any = null;

    constructor(private readonly _extensionUri: vscode.Uri, backendUrl: string) {
        this.backendUrl = backendUrl;
        this.wsUrl = this.backendUrl.replace(/^http/, 'ws');
        this.audioRecorder = new AudioRecorder();
        
        // Set up transcription callback
        this.audioRecorder.setTranscriptionCallback((transcript, isFinal) => {
            if (this._panel) {
                this._panel.webview.postMessage({
                    type: 'transcription',
                    transcript,
                    isFinal
                });
            }
        });

        // Set up disconnect callback
        this.audioRecorder.setDisconnectCallback(() => {
            // Reset connection state
            this.connectionInfo = null;
            if (this._panel) {
                this._panel.webview.postMessage({
                    type: 'disconnected',
                    message: 'Connection to backend lost'
                });
            }
            vscode.window.showWarningMessage('Connection to backend server lost. Please reconnect.');
        });
    }

    public async show() {
        if (this._panel) {
            this._panel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            CoordinatorPanel.viewType,
            'Hiya Coordinator',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [this._extensionUri],
                retainContextWhenHidden: true
            }
        );

        this._panel = panel;
        this._panel.webview.html = await this._getHtmlForWebview();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Send backend URL to initialize JavaScript
        this._panel.webview.postMessage({
            type: 'initialize',
            backendUrl: this.backendUrl
        });

        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case 'showInfo':
                        vscode.window.showInformationMessage(message.text);
                        break;
                    case 'showError':
                        vscode.window.showErrorMessage(message.text);
                        break;
                    case 'transcription':
                        // Optional: could show notifications or log transcriptions
                        break;
                    case 'connected':
                        // Store connection info for audio recording
                        this.connectionInfo = message.connectionInfo;
                        // Disconnect existing audio recorder connection if any
                        this.audioRecorder.disconnect();
                        break;
                    case 'startRecording':
                        await this.handleStartRecording();
                        break;
                    case 'stopRecording':
                        this.handleStopRecording();
                        break;
                    case 'generateCode':
                        await this.handleGenerateCode(message.connectionInfo);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public toggleSpeech() {
        if (this._panel) {
            if (this.audioRecorder.getRecordingState()) {
                this.handleStopRecording();
            } else {
                this.handleStartRecording();
            }
        }
    }

    private async handleStartRecording() {
        if (!this.connectionInfo) {
            vscode.window.showErrorMessage('Not connected to repository. Please connect first.');
            if (this._panel) {
                this._panel.webview.postMessage({
                    type: 'recordingError',
                    message: 'Not connected to repository'
                });
            }
            return;
        }

        try {
            await this.audioRecorder.startRecording(this.wsUrl, this.connectionInfo);
            
            vscode.window.showInformationMessage('Speech recognition started');
            if (this._panel) {
                this._panel.webview.postMessage({
                    type: 'recordingStarted'
                });
            }
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to start recording';
            vscode.window.showErrorMessage(`Failed to start recording: ${errorMessage}`);
            if (this._panel) {
                this._panel.webview.postMessage({
                    type: 'recordingError',
                    message: errorMessage
                });
            }
        }
    }

    private handleStopRecording() {
        this.audioRecorder.stopRecording();
        vscode.window.showInformationMessage('Speech recognition stopped');
        if (this._panel) {
            this._panel.webview.postMessage({
                type: 'recordingStopped'
            });
        }
    }

    private async handleGenerateCode(connectionInfo: any) {
        if (!connectionInfo) {
            if (this._panel) {
                this._panel.webview.postMessage({
                    type: 'codeGenError',
                    message: 'No connection info available'
                });
            }
            return;
        }

        if (this._panel) {
            this._panel.webview.postMessage({
                type: 'codeGenStarted'
            });
        }

        try {
            // Use the existing AudioRecorder websocket connection
            await this.audioRecorder.sendMessage({
                type: 'generate_code',
                repoId: connectionInfo.repoId,
                userName: connectionInfo.userName,
                branch: connectionInfo.branch
            }, this.wsUrl);

            if (this._panel) {
                this._panel.webview.postMessage({
                    type: 'codeGenComplete'
                });
            }
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to generate code';
            if (this._panel) {
                this._panel.webview.postMessage({
                    type: 'codeGenError',
                    message: errorMessage
                });
            }
        }
    }

    public dispose() {
        this.audioRecorder.dispose();
        
        if (this._panel) {
            this._panel.dispose();
        }

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    // Generating nonce for Content Security Policy
    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
}

    private async _getHtmlForWebview(): Promise<string> {
        // Get paths to media files
        const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'panel.html');
        const cssPath = path.join(this._extensionUri.fsPath, 'media', 'panel.css');
        const jsPath = path.join(this._extensionUri.fsPath, 'media', 'panel.js');

            // 1. Generate a nonce
            const nonce = this.getNonce();

            // 2. Build just the CONTENT of the CSP tag as a single string
            const cspContent = [
                "default-src 'none'",
                `style-src ${this._panel!.webview.cspSource} 'unsafe-inline'`,
                `script-src 'nonce-${nonce}'`,
                "media-src 'self' blob:",
                `connect-src ${this.backendUrl} ${this.wsUrl}`
            ].join('; '); // Join the directives with a semicolon and a space

        // Convert to webview URIs
        const cssUri = this._panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'panel.css')
        );
        const jsUri = this._panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'panel.js')
        );

        // Read HTML file
        let html = fs.readFileSync(htmlPath, 'utf-8');

        // Replace placeholders with actual URIs
        html = html.replace('{{cssUri}}', cssUri.toString());
        html = html.replace('{{jsUri}}', jsUri.toString());
        html = html.replace('{{cspContent}}', cspContent);
        html = html.replace('{{nonce}}', nonce);

        return html;
    }
}

