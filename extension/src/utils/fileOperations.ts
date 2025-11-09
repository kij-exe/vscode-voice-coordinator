import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Create patches directory if it doesn't exist
 * @param workspaceFolder - Workspace folder
 * @returns Patches directory path
 */
function createPatchesDirectory(workspaceFolder: vscode.WorkspaceFolder): string {
    const patchesDir = path.join(workspaceFolder.uri.fsPath, 'patches');
    if (!fs.existsSync(patchesDir)) {
        fs.mkdirSync(patchesDir, { recursive: true });
    }
    return patchesDir;
}

/**
 * Get safe filename by replacing slashes with underscores
 * @param filename - Original filename
 * @returns Safe filename
 */
function getSafeFilename(filename: string): string {
    return filename.replace(/\//g, '_');
}

/**
 * Save a single patch file
 * @param patchesDir - Patches directory path
 * @param file - File object with filename and patch
 * @returns Saved filename or null if invalid
 */
function savePatchFile(patchesDir: string, file: any): string | null {
    if (!file.filename || !file.patch) {
        return null;
    }

    const safeFilename = getSafeFilename(file.filename);
    const patchFilename = `${safeFilename}.patch`;
    const patchPath = path.join(patchesDir, patchFilename);

    fs.writeFileSync(patchPath, file.patch, 'utf-8');
    return patchFilename;
}

/**
 * Save patch files to workspace
 * @param result - Code generation result with files array
 * @returns Array of saved filenames
 */
export function savePatches(result: any): string[] {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new Error('No workspace folder open. Please open a workspace first.');
    }

    const patchesDir = createPatchesDirectory(workspaceFolder);
    const savedFiles: string[] = [];

    for (const file of result.files || []) {
        const savedFilename = savePatchFile(patchesDir, file);
        if (savedFilename) {
            savedFiles.push(savedFilename);
        }
    }

    return savedFiles;
}

