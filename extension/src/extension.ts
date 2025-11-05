import * as vscode from 'vscode';
import { CoordinatorPanel } from './panel';

let coordinatorPanel: CoordinatorPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Hiya Coordinator extension is now active');

    // Get backend URL from configuration
    const backendUrl = vscode.workspace.getConfiguration('hiyaCoordinator').get<string>('backendUrl', 'http://localhost:3000');

    // Create coordinator panel
    coordinatorPanel = new CoordinatorPanel(context.extensionUri, backendUrl);

    // Register commands
    const connectCommand = vscode.commands.registerCommand('hiyaCoordinator.connect', async () => {
        await coordinatorPanel?.show();
    });

    const toggleSpeechCommand = vscode.commands.registerCommand('hiyaCoordinator.toggleSpeech', () => {
        coordinatorPanel?.toggleSpeech();
    });

    context.subscriptions.push(connectCommand, toggleSpeechCommand);
}

export function deactivate() {
    coordinatorPanel?.dispose();
}

