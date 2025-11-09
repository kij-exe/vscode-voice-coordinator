import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate a nonce for Content Security Policy
 * @returns Random nonce string
 */
export function generateNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Build Content Security Policy content
 * @param webview - Webview instance
 * @param backendUrl - Backend URL
 * @param wsUrl - WebSocket URL
 * @returns CSP content string
 */
export function buildCSPContent(
    webview: vscode.Webview,
    backendUrl: string,
    wsUrl: string
): string {
    return [
        "default-src 'none'",
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-{{nonce}}'`,
        "media-src 'self' blob:",
        `connect-src ${backendUrl} ${wsUrl}`
    ].join('; ');
}

/**
 * Get webview URIs for media files
 * @param extensionUri - Extension URI
 * @param webview - Webview instance
 * @returns Object with cssUri and jsUri
 */
export function getWebviewUris(
    extensionUri: vscode.Uri,
    webview: vscode.Webview
): { cssUri: vscode.Uri; jsUri: vscode.Uri } {
    return {
        cssUri: webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'media', 'panel.css')
        ),
        jsUri: webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'media', 'panel.js')
        )
    };
}

/**
 * Generate HTML for webview
 * @param extensionUri - Extension URI
 * @param webview - Webview instance
 * @param backendUrl - Backend URL
 * @param wsUrl - WebSocket URL
 * @returns HTML string
 */
export function generateWebviewHtml(
    extensionUri: vscode.Uri,
    webview: vscode.Webview,
    backendUrl: string,
    wsUrl: string
): string {
    const nonce = generateNonce();
    const cspContent = buildCSPContent(webview, backendUrl, wsUrl).replace('{{nonce}}', nonce);
    const { cssUri, jsUri } = getWebviewUris(extensionUri, webview);

    const htmlPath = path.join(extensionUri.fsPath, 'media', 'panel.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    // Replace placeholders
    html = html.replace('{{cssUri}}', cssUri.toString());
    html = html.replace('{{jsUri}}', jsUri.toString());
    html = html.replace('{{cspContent}}', cspContent);
    html = html.replace('{{nonce}}', nonce);

    return html;
}

