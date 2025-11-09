import * as vscode from 'vscode';
import { AudioRecorder } from './audioRecorder';
import { sendToWebview, showError, showInfo } from './utils/webviewMessages';
import { generateWebviewHtml } from './utils/htmlGenerator';
import { savePatches } from './utils/fileOperations';
import {
    createTranscriptionCallback,
    createDisconnectCallback,
    createCodeGenerationCallback,
    createAudioPlaybackCallback
} from './utils/callbacks';

export class CoordinatorPanel {
    public static readonly viewType = 'hiyaCoordinator';
    private _panel: vscode.WebviewPanel | undefined;
    private _disposables: vscode.Disposable[] = [];
    private backendUrl: string;
    private wsUrl: string;
    private audioRecorder: AudioRecorder;
    private connectionInfo: any = null;
    private setPendingAudio: ((data: string, format: string) => void) | null = null;

    constructor(private readonly _extensionUri: vscode.Uri, backendUrl: string) {
        this.backendUrl = backendUrl;
        this.wsUrl = this.backendUrl.replace(/^http/, 'ws');
        this.audioRecorder = new AudioRecorder();
        this.setupCallbacks();
    }

    private setupCallbacks(): void {
        const getPanel = () => this._panel;

        this.audioRecorder.setTranscriptionCallback(
            createTranscriptionCallback(getPanel)
        );

        this.audioRecorder.setDisconnectCallback(
            createDisconnectCallback(getPanel, () => {
                this.connectionInfo = null;
            })
        );

        const { callback: codeGenCallback, setPendingAudio } = createCodeGenerationCallback(
            getPanel,
            this.handleSavePatches.bind(this),
            this.playAudio.bind(this)
        );

        this.setPendingAudio = setPendingAudio;
        this.audioRecorder.setCodeGenerationCallback(codeGenCallback);
        this.audioRecorder.setAudioPlaybackCallback(
            createAudioPlaybackCallback(setPendingAudio)
        );
    }

    public async show() {
        if (this._panel) {
            this._panel.reveal();
            return;
        }

        this._panel = this.createWebviewPanel();
        this._panel.webview.html = await this.getWebviewHtml();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this.initializeWebview();
        this.setupMessageHandlers();
    }

    private createWebviewPanel(): vscode.WebviewPanel {
        return vscode.window.createWebviewPanel(
            CoordinatorPanel.viewType,
            'Hiya Coordinator',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [this._extensionUri],
                retainContextWhenHidden: true
            }
        );
    }

    private initializeWebview(): void {
        sendToWebview(this._panel, {
            type: 'initialize',
            backendUrl: this.backendUrl
        });
    }

    private setupMessageHandlers(): void {
        if (!this._panel) return;

        this._panel.webview.onDidReceiveMessage(
            async (message: any) => {
                await this.handleWebviewMessage(message);
            },
            null,
            this._disposables
        );
    }

    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'showInfo':
                vscode.window.showInformationMessage(message.text);
                break;

            case 'showError':
                vscode.window.showErrorMessage(message.text);
                break;

            case 'connected':
                this.connectionInfo = message.connectionInfo;
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
    }

    public toggleSpeech() {
        if (!this._panel) return;

        if (this.audioRecorder.getRecordingState()) {
            this.handleStopRecording();
        } else {
            this.handleStartRecording();
        }
    }

    private async handleStartRecording() {
        if (!this.connectionInfo) {
            showError(this._panel, 'Not connected to repository. Please connect first.', 'recordingError');
            return;
        }

        try {
            await this.audioRecorder.startRecording(this.wsUrl, this.connectionInfo);
            showInfo(this._panel, 'Speech recognition started');
            sendToWebview(this._panel, { type: 'recordingStarted' });
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to start recording';
            showError(this._panel, `Failed to start recording: ${errorMessage}`, 'recordingError');
        }
    }

    private handleStopRecording() {
        this.audioRecorder.stopRecording();
        showInfo(this._panel, 'Speech recognition stopped');
        sendToWebview(this._panel, { type: 'recordingStopped' });
    }

    private playAudio(base64Data: string, format: string = 'mp3') {
        try {
            sendToWebview(this._panel, {
                type: 'playAudio',
                audioData: base64Data,
                format: format
            });
        } catch (error: any) {
            console.error('Error sending audio to webview:', error);
        }
    }

    private async handleSavePatches(result: any): Promise<void> {
        try {
            const savedFiles = savePatches(result);

            if (savedFiles.length > 0) {
                showInfo(this._panel, `Saved ${savedFiles.length} patch file(s) to patches/ directory`);
                console.log(`Saved patches: ${savedFiles.join(', ')}`);
            }

            sendToWebview(this._panel, {
                type: 'patchesSaved',
                count: savedFiles.length
            });
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to save patches';
            showError(this._panel, `Error saving patches: ${errorMessage}`);
            console.error('Error saving patches:', error);
            sendToWebview(this._panel, {
                type: 'patchesSaved',
                count: 0
            });
        }
    }

    private async handleGenerateCode(connectionInfo: any) {
        if (!connectionInfo) {
            sendToWebview(this._panel, {
                type: 'codeGenError',
                message: 'No connection info available'
            });
            return;
        }

        sendToWebview(this._panel, {
            type: 'codeGenStarted'
        });

        try {
            await this.audioRecorder.sendMessage({
                type: 'generate_code',
                repoId: connectionInfo.repoId,
                userName: connectionInfo.userName,
                branch: connectionInfo.branch
            }, this.wsUrl);
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to generate code';
            sendToWebview(this._panel, {
                type: 'codeGenError',
                message: errorMessage
            });
        }
    }

    private async getWebviewHtml(): Promise<string> {
        if (!this._panel) {
            throw new Error('Panel not initialized');
        }

        return generateWebviewHtml(
            this._extensionUri,
            this._panel.webview,
            this.backendUrl,
            this.wsUrl
        );
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
}
