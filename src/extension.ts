import * as vscode from 'vscode';
import * as path from 'path';
import { Minimatch } from 'minimatch';

interface Configuration {
    ignoreDirs: Set<string>;
    ignorePatterns: string[];
    maxFiles: number;
    maxTotalLines: number;
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('clipsource.copyToClipboard', async (uri?: vscode.Uri) => {
        try {
            let targetUri = uri;
            if (!targetUri) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    throw new Error('No workspace folder open');
                }
                targetUri = workspaceFolders[0].uri;
            }

            const result = await collectPythonFiles(targetUri);
            
            if (result.reachedMaxFiles) {
                vscode.window.showWarningMessage(`File limit reached (${result.processedFiles} files). Some files were skipped.`);
            }
            if (result.reachedMaxLines) {
                vscode.window.showWarningMessage(`Line limit reached (${result.totalLines} lines). Some files were skipped.`);
            }
            
            if (result.output.trim() === '') {
                vscode.window.showInformationMessage('No Python files found in the selected directory');
                return;
            }

            await vscode.env.clipboard.writeText(result.output);
            vscode.window.showInformationMessage(
                `Copied ${result.processedFiles} files (${result.totalLines} lines) to clipboard as markdown!`
            );
        } catch (error) {
            vscode.window.showErrorMessage('Failed to copy codebase: ' + (error instanceof Error ? error.message : String(error)));
        }
    });

    context.subscriptions.push(disposable);
}

function getConfiguration(): Configuration {
    const config = vscode.workspace.getConfiguration('clipsource');
    return {
        ignoreDirs: new Set(config.get<string[]>('ignoreDirs') || []),
        ignorePatterns: config.get<string[]>('ignorePatterns') || [],
        maxFiles: config.get<number>('maxFiles') || 50,
        maxTotalLines: config.get<number>('maxTotalLines') || 5000
    };
}

function shouldIgnorePath(relativePath: string, baseDir: string, config: Configuration) {
    const pathParts = relativePath.split(path.sep);
    if (pathParts.some(part => config.ignoreDirs.has(part))) {
        return true;
    }

    const fullPath = path.join(baseDir, relativePath);
    return config.ignorePatterns.some(pattern => {
        const matcher = new Minimatch(pattern);
        return matcher.match(fullPath);
    });
}

interface CollectionResult {
    output: string;
    processedFiles: number;
    totalLines: number;
    reachedMaxFiles: boolean;
    reachedMaxLines: boolean;
}

async function collectPythonFiles(folderUri: vscode.Uri): Promise<CollectionResult> {
    const config = getConfiguration();
    const output: string[] = [];
    let processedFiles = 0;
    let totalLines = 0;
    let reachedMaxFiles = false;
    let reachedMaxLines = false;
    
    async function processDirectory(uri: vscode.Uri): Promise<boolean> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(uri);
            
            for (const [name, type] of entries) {
                if (processedFiles >= config.maxFiles || totalLines >= config.maxTotalLines) {
                    reachedMaxFiles = processedFiles >= config.maxFiles;
                    reachedMaxLines = totalLines >= config.maxTotalLines;
                    return false;
                }

                const currentUri = vscode.Uri.joinPath(uri, name);
                const relativePath = path.relative(folderUri.fsPath, currentUri.fsPath);

                if (shouldIgnorePath(relativePath, folderUri.fsPath, config)) {
                    continue;
                }

                if (type === vscode.FileType.Directory) {
                    const shouldContinue = await processDirectory(currentUri);
                    if (!shouldContinue) return false;
                } else if (type === vscode.FileType.File && name.endsWith('.py')) {
                    const content = await vscode.workspace.fs.readFile(currentUri);
                    const fileContent = Buffer.from(content).toString('utf-8');
                    const lineCount = fileContent.split('\n').length;
                    
                    if (totalLines + lineCount > config.maxTotalLines) {
                        reachedMaxLines = true;
                        return false;
                    }

                    totalLines += lineCount;
                    processedFiles++;
                    output.push(`File: ${relativePath}\n\`\`\`python\n${fileContent}\n\`\`\`\n`);
                }
            }
            return true;
        } catch (error) {
            console.error(`Error processing directory: ${error}`);
            return true;
        }
    }

    await processDirectory(folderUri);

    return {
        output: output.join('\n'),
        processedFiles,
        totalLines,
        reachedMaxFiles,
        reachedMaxLines
    };
}

export function deactivate() {}