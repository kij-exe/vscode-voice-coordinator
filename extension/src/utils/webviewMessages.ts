import * as vscode from 'vscode';

/**
 * Send a message to the webview panel if it exists
 * @param panel - Webview panel (may be undefined)
 * @param message - Message to send
 */
export function sendToWebview(panel: vscode.WebviewPanel | undefined, message: any): void {
    if (panel) {
        panel.webview.postMessage(message);
    }
}

/**
 * Show error message and notify webview
 * @param panel - Webview panel (may be undefined)
 * @param errorMessage - Error message to display
 * @param messageType - Type of message to send to webview
 */
export function showError(
    panel: vscode.WebviewPanel | undefined,
    errorMessage: string,
    messageType: string = 'error'
): void {
    vscode.window.showErrorMessage(errorMessage);
    sendToWebview(panel, {
        type: messageType,
        message: errorMessage
    });
}

/**
 * Show info message and notify webview
 * @param panel - Webview panel (may be undefined)
 * @param infoMessage - Info message to display
 * @param messageType - Type of message to send to webview
 */
export function showInfo(
    panel: vscode.WebviewPanel | undefined,
    infoMessage: string,
    messageType?: string
): void {
    vscode.window.showInformationMessage(infoMessage);
    if (messageType) {
        sendToWebview(panel, {
            type: messageType,
            message: infoMessage
        });
    }
}

