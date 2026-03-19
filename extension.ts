import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { analyzeProject } from './analyzers/projectAnalyzer';
import { generateDiagrams } from './diagram/diagramGenerator';
import { generateHTML } from './html/generateHTML';
import { logger } from './logger';
import { ErrorHandler, withErrorHandling } from './errorHandler';
import { createConfigManager } from './configManager';

let outputChannel: vscode.OutputChannel;
let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  try {
    outputChannel = vscode.window.createOutputChannel('Flow Visualizer');
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'flow-visualizer.analyze';
    statusBar.show();

    logger.info('Flow Visualizer extension activating...');

    // Command 1: Analyze Project
    const analyzeCommand = vscode.commands.registerCommand(
      'flow-visualizer.analyze',
      async () => {
        try {
          await analyzeAndGenerateDocs();
        } catch (error) {
          const handled = ErrorHandler.handle(error, 'Analyze Command');
          showErrorMessage(handled);
        }
      }
    );

    // Command 2: Analyze Current File
    const analyzeFileCommand = vscode.commands.registerCommand(
      'flow-visualizer.analyzeFile',
      async (uri: vscode.Uri) => {
        try {
          if (uri) {
            await analyzeSpecificFile(uri);
          }
        } catch (error) {
          const handled = ErrorHandler.handle(error, 'Analyze File Command');
          showErrorMessage(handled);
        }
      }
    );

    // Command 3: Show Architecture Overview
    const showOverviewCommand = vscode.commands.registerCommand(
      'flow-visualizer.showOverview',
      async () => {
        try {
          await showArchitectureOverview();
        } catch (error) {
          const handled = ErrorHandler.handle(error, 'Show Overview Command');
          showErrorMessage(handled);
        }
      }
    );

    // Command 4: Export Analysis
    const exportCommand = vscode.commands.registerCommand(
      'flow-visualizer.export',
      async () => {
        try {
          await exportAnalysis();
        } catch (error) {
          const handled = ErrorHandler.handle(error, 'Export Command');
          showErrorMessage(handled);
        }
      }
    );

    // Command 5: Show Request Flow
    const showFlowCommand = vscode.commands.registerCommand(
      'flow-visualizer.showFlow',
      async () => {
        try {
          await showRequestFlow();
        } catch (error) {
          const handled = ErrorHandler.handle(error, 'Show Flow Command');
          showErrorMessage(handled);
        }
      }
    );

    // Command 6: Open Documentation
    const openDocsCommand = vscode.commands.registerCommand(
      'flow-visualizer.openDocs',
      async () => {
        try {
          await openGeneratedDocs();
        } catch (error) {
          const handled = ErrorHandler.handle(error, 'Open Docs Command');
          showErrorMessage(handled);
        }
      }
    );

    context.subscriptions.push(
      analyzeCommand,
      analyzeFileCommand,
      showOverviewCommand,
      exportCommand,
      showFlowCommand,
      openDocsCommand
    );

    // Create sidebar view provider
    const viewProvider = new FlowVisualizerViewProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'flow-visualizer.sidebar',
        viewProvider
      )
    );

    logger.info('Flow Visualizer extension activated successfully');
    updateStatusBar('✓ Flow Visualizer Ready');
  } catch (error) {
    const handled = ErrorHandler.handle(error, 'Extension Activation');
    logger.error('Failed to activate extension:', handled);
    showErrorMessage(handled);
  }
}

async function analyzeAndGenerateDocs() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    throw new Error('No workspace folder open');
  }

  const projectPath = workspaceFolder.uri.fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing project structure...',
      cancellable: false,
    },
    async (progress) => {
      try {
        updateStatusBar('⏳ Analyzing...');

        progress.report({ increment: 0 });
        logger.info(`Starting analysis on: ${projectPath}`);

        const analysis = await withErrorHandling(
          async () => analyzeProject(projectPath),
          'Project Analysis',
          1 // Retry once
        );

        progress.report({ increment: 50, message: 'Generating diagrams...' });
        logger.info(`Found ${analysis.routes.length} routes`);

        const diagrams = generateDiagrams(analysis);

        progress.report({ increment: 75, message: 'Creating documentation...' });

        const config = createConfigManager(projectPath);
        const outputDir = path.join(projectPath, config.getOption('output'));

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const htmlPath = await generateHTML(analysis, diagrams, outputDir);

        progress.report({ increment: 100 });

        updateStatusBar('✓ Analysis Complete');
        logger.info(`Documentation generated at: ${htmlPath}`);

        const openButton = 'Open Documentation';
        const result = await vscode.window.showInformationMessage(
          `✓ Analysis complete! Found ${analysis.routes.length} routes`,
          openButton
        );

        if (result === openButton) {
          const htmlUri = vscode.Uri.file(htmlPath);
          vscode.env.openExternal(htmlUri);
        }
      } catch (error) {
        updateStatusBar('✗ Analysis Failed');
        throw error;
      }
    }
  );
}

async function analyzeSpecificFile(uri: vscode.Uri) {
  const filePath = uri.fsPath;
  logger.info(`Analyzing file: ${filePath}`);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    const routeCount = (content.match(/app\.(get|post|put|delete|patch)/g) || []).length;
    const functionCount = (content.match(/function|const.*=.*\(/g) || []).length;

    vscode.window.showInformationMessage(
      `File Analysis: ${routeCount} routes, ${functionCount} functions found`
    );

    logger.info(`File analysis completed: ${routeCount} routes, ${functionCount} functions`);
  } catch (error) {
    const handled = ErrorHandler.handle(error, 'File Analysis');
    throw handled;
  }
}

async function showArchitectureOverview() {
  const panel = vscode.window.createWebviewPanel(
    'architectureOverview',
    'Architecture Overview',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getArchitectureHtml();
  logger.info('Architecture overview panel opened');
}

async function exportAnalysis() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    throw new Error('No workspace folder open');
  }

  const projectPath = workspaceFolder.uri.fsPath;

  try {
    updateStatusBar('⏳ Exporting...');

    const analysis = await analyzeProject(projectPath);

    const exportData = {
      timestamp: new Date().toISOString(),
      framework: analysis.framework,
      stats: {
        routes: analysis.routes.length,
        controllers: analysis.controllers.length,
        services: analysis.services.length,
        middleware: analysis.middleware.length,
      },
      routes: analysis.routes.slice(0, 50), // Limit to first 50
    };

    const exportPath = path.join(projectPath, 'flow-analysis.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

    updateStatusBar('✓ Export Complete');
    vscode.window.showInformationMessage(`Analysis exported to: ${exportPath}`);
    logger.info(`Analysis exported to: ${exportPath}`);
  } catch (error) {
    updateStatusBar('✗ Export Failed');
    throw error;
  }
}

async function showRequestFlow() {
  const panel = vscode.window.createWebviewPanel(
    'requestFlow',
    'Request Flow Diagram',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const mermaidDiagram = `
    graph LR
      A["HTTP Request"] --> B{Router}
      B --> C["Middleware 1"]
      B --> D["Middleware 2"]
      C --> E["Controller"]
      D --> E
      E --> F["Service"]
      F --> G["Database"]
      G --> H["Response"]
  `;

  panel.webview.html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
        <style>
          body { background: #1e1e1e; color: #fff; font-family: 'Segoe UI'; padding: 20px; }
          .mermaid { background: #252526; padding: 20px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>📊 Request Flow Diagram</h1>
        <div class="mermaid">${mermaidDiagram}</div>
        <script>
          mermaid.initialize({ startOnLoad: true, theme: 'dark' });
          mermaid.contentLoaded();
        </script>
      </body>
    </html>
  `;

  logger.info('Request flow diagram opened');
}

async function openGeneratedDocs() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    throw new Error('No workspace folder open');
  }

  const config = createConfigManager(workspaceFolder.uri.fsPath);
  const docsPath = path.join(
    workspaceFolder.uri.fsPath,
    config.getOption('output'),
    'index.html'
  );

  if (!fs.existsSync(docsPath)) {
    throw new Error(
      'Documentation not found. Run "Flow Visualizer: Analyze Project" first.'
    );
  }

  vscode.env.openExternal(vscode.Uri.file(docsPath));
  logger.info(`Documentation opened: ${docsPath}`);
}

function getArchitectureHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { background: #1e1e1e; color: #e0e0e0; padding: 20px; }
          .card { background: #252526; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #007acc; }
          h1 { color: #4ec9b0; }
          .stat { font-size: 24px; font-weight: bold; color: #007acc; }
        </style>
      </head>
      <body>
        <h1>🏗️ Project Architecture Overview</h1>
        <div class="card">
          <h2>Analysis Status</h2>
          <p>Run "Flow Visualizer: Analyze Project" to generate architecture diagrams.</p>
        </div>
      </body>
    </html>
  `;
}

function updateStatusBar(text: string): void {
  statusBar.text = text;
}

function showErrorMessage(error: any): void {
  const message = ErrorHandler.getErrorMessage(error);
  vscode.window.showErrorMessage(`❌ ${message}`);
  outputChannel.appendLine(`ERROR: ${message}`);
}

class FlowVisualizerViewProvider implements vscode.WebviewViewProvider {
  constructor(private extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getWebviewContent();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      try {
        if (message.command === 'analyze') {
          await analyzeAndGenerateDocs();
        } else if (message.command === 'showFlow') {
          await showRequestFlow();
        } else if (message.command === 'export') {
          await exportAnalysis();
        }
      } catch (error) {
        const handled = ErrorHandler.handle(error, 'Sidebar Command');
        showErrorMessage(handled);
      }
    });
  }

  private getWebviewContent(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { background: transparent; color: #e0e0e0; font-family: 'Segoe UI'; padding: 10px; }
            h2 { color: #4ec9b0; font-size: 14px; text-transform: uppercase; }
            button { width: 100%; padding: 10px; margin: 8px 0; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #005a9e; }
          </style>
        </head>
        <body>
          <h2>📊 Flow Visualizer</h2>
          <button onclick="sendCommand('analyze')">🔍 Analyze Project</button>
          <button onclick="sendCommand('showFlow')">📈 Show Request Flow</button>
          <button onclick="sendCommand('export')">📥 Export Analysis</button>
          <script>
            const vscode = acquireVsCodeApi();
            function sendCommand(command) {
              vscode.postMessage({ command });
            }
          </script>
        </body>
      </html>
    `;
  }
}

export function deactivate() {
  outputChannel.dispose();
  statusBar.dispose();
}