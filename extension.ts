import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { analyzeProject } from './analyzers/projectAnalyzer';
import { generateDiagrams } from './diagram/mermaidGenerator';
import { generateHTML } from './html/generateHTML';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Flow Visualizer');
  
  console.log('Flow Visualizer extension is now active!');
  outputChannel.appendLine('Flow Visualizer activated');

  // Command 1: Analyze Project and Generate Documentation
  const analyzeCommand = vscode.commands.registerCommand(
    'flow-visualizer.analyze',
    async () => {
      await analyzeAndGenerateDocs();
    }
  );

  // Command 2: Analyze Current File
  const analyzeFileCommand = vscode.commands.registerCommand(
    'flow-visualizer.analyzeFile',
    async (uri: vscode.Uri) => {
      if (uri) {
        await analyzeSpecificFile(uri);
      }
    }
  );

  // Command 3: Show Architecture Overview
  const showOverviewCommand = vscode.commands.registerCommand(
    'flow-visualizer.showOverview',
    async () => {
      await showArchitectureOverview();
    }
  );

  // Command 4: Export Analysis
  const exportCommand = vscode.commands.registerCommand(
    'flow-visualizer.export',
    async () => {
      await exportAnalysis();
    }
  );

  // Command 5: Show Request Flow for Route
  const showFlowCommand = vscode.commands.registerCommand(
    'flow-visualizer.showFlow',
    async () => {
      await showRequestFlow();
    }
  );

  // Command 6: Open Documentation
  const openDocsCommand = vscode.commands.registerCommand(
    'flow-visualizer.openDocs',
    async () => {
      await openGeneratedDocs();
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

  outputChannel.appendLine('All commands registered successfully');
}

/**
 * Main function: Analyze project and generate documentation
 */
async function analyzeAndGenerateDocs() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const projectPath = workspaceFolder.uri.fsPath;

  try {
    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing project structure...',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0 });

        // Analyze project
        outputChannel.appendLine(`Starting analysis on: ${projectPath}`);
        const analysis = await analyzeProject(projectPath, {
          includeDatabase: true,
          includeMiddleware: true,
          includeServices: true,
        });

        progress.report({ increment: 50, message: 'Generating diagrams...' });
        outputChannel.appendLine(`Found ${analysis.routes.length} routes`);

        // Generate diagrams
        const diagrams = generateDiagrams(analysis, {
          format: 'mermaid',
          interactive: true,
        });

        progress.report({ increment: 75, message: 'Creating documentation...' });

        // Create output directory
        const outputDir = path.join(projectPath, '.flow-visualizer');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate HTML
        const htmlPath = await generateHTML(analysis, diagrams, outputDir);

        progress.report({ increment: 100 });

        // Show success message
        const openButton = 'Open Documentation';
        const result = await vscode.window.showInformationMessage(
          `✓ Flow visualization generated! Found ${analysis.routes.length} routes`,
          openButton
        );

        if (result === openButton) {
          const htmlUri = vscode.Uri.file(htmlPath);
          vscode.env.openExternal(htmlUri);
        }

        outputChannel.appendLine(`Documentation generated at: ${htmlPath}`);
      }
    );
  } catch (error) {
    outputChannel.appendLine(`Error: ${(error as Error).message}`);
    vscode.window.showErrorMessage(
      `Analysis failed: ${(error as Error).message}`
    );
  }
}

/**
 * Analyze specific file
 */
async function analyzeSpecificFile(uri: vscode.Uri) {
  const filePath = uri.fsPath;
  outputChannel.appendLine(`Analyzing file: ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Count routes, functions, etc.
    const routeCount = (content.match(/app\.(get|post|put|delete|patch)/g) || []).length;
    const functionCount = (content.match(/function|const.*=.*\(/g) || []).length;
    
    vscode.window.showInformationMessage(
      `File Analysis: ${routeCount} routes, ${functionCount} functions found`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to analyze file: ${(error as Error).message}`);
  }
}

/**
 * Show architecture overview in a webview
 */
async function showArchitectureOverview() {
  const panel = vscode.window.createWebviewPanel(
    'architectureOverview',
    'Architecture Overview',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getArchitectureHtml();
}

/**
 * Export analysis results
 */
async function exportAnalysis() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const projectPath = workspaceFolder.uri.fsPath;

  try {
    const analysis = await analyzeProject(projectPath, {});
    
    // Create JSON export
    const exportData = {
      timestamp: new Date().toISOString(),
      framework: analysis.framework,
      routeCount: analysis.routes.length,
      controllerCount: analysis.controllers.length,
      serviceCount: analysis.services.length,
      middlewareCount: analysis.middleware.length,
      routes: analysis.routes,
      controllers: analysis.controllers,
      services: analysis.services,
    };

    const exportPath = path.join(projectPath, 'flow-analysis.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

    vscode.window.showInformationMessage(`Analysis exported to: ${exportPath}`);
    outputChannel.appendLine(`Analysis exported to: ${exportPath}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Export failed: ${(error as Error).message}`);
  }
}

/**
 * Show request flow for a specific route
 */
async function showRequestFlow() {
  const panel = vscode.window.createWebviewPanel(
    'requestFlow',
    'Request Flow Diagram',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const mermaidDiagram = `
    graph LR
      A[HTTP Request] --> B{Router}
      B --> C[Middleware 1]
      B --> D[Middleware 2]
      C --> E[Controller]
      D --> E
      E --> F[Service]
      F --> G[Database]
      G --> H[Response]
  `;

  panel.webview.html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
        <style>
          body { background: #1e1e1e; color: #fff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
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
}

/**
 * Open generated documentation
 */
async function openGeneratedDocs() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const docsPath = path.join(workspaceFolder.uri.fsPath, '.flow-visualizer', 'index.html');
  
  if (!fs.existsSync(docsPath)) {
    vscode.window.showErrorMessage(
      'Documentation not found. Run "Flow Visualizer: Analyze Project" first.'
    );
    return;
  }

  vscode.env.openExternal(vscode.Uri.file(docsPath));
}

/**
 * Get HTML for architecture overview
 */
function getArchitectureHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { 
            background: #1e1e1e; 
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            margin: 0;
          }
          h1 { color: #4ec9b0; margin-bottom: 20px; }
          .container { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 20px;
            max-width: 1200px;
          }
          .card {
            background: #252526;
            border-left: 4px solid #007acc;
            padding: 15px;
            border-radius: 6px;
          }
          .card h2 { 
            color: #4ec9b0; 
            font-size: 16px;
            margin: 0 0 10px 0;
          }
          .card p { 
            color: #888;
            margin: 5px 0;
            font-size: 14px;
          }
          .stat {
            font-size: 24px;
            font-weight: bold;
            color: #007acc;
          }
        </style>
      </head>
      <body>
        <h1>🏗️ Project Architecture Overview</h1>
        <div class="container">
          <div class="card">
            <h2>Routes</h2>
            <p class="stat">--</p>
            <p>HTTP endpoints found</p>
          </div>
          <div class="card">
            <h2>Controllers</h2>
            <p class="stat">--</p>
            <p>Controller classes</p>
          </div>
          <div class="card">
            <h2>Services</h2>
            <p class="stat">--</p>
            <p>Business logic services</p>
          </div>
          <div class="card">
            <h2>Middleware</h2>
            <p class="stat">--</p>
            <p>Middleware functions</p>
          </div>
        </div>
        <p style="margin-top: 30px; color: #888;">Run "Flow Visualizer: Analyze Project" to populate these stats.</p>
      </body>
    </html>
  `;
}

/**
 * Sidebar view provider
 */
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
      if (message.command === 'analyze') {
        await analyzeAndGenerateDocs();
      } else if (message.command === 'showFlow') {
        await showRequestFlow();
      } else if (message.command === 'export') {
        await exportAnalysis();
      }
    });
  }

  private getWebviewContent(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              background: transparent;
              color: #e0e0e0;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 10px;
              margin: 0;
            }
            h2 { 
              color: #4ec9b0; 
              font-size: 14px;
              margin: 0 0 10px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            button {
              width: 100%;
              padding: 10px;
              margin-bottom: 8px;
              background: #007acc;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              transition: background 0.2s;
            }
            button:hover {
              background: #005a9e;
            }
            .divider {
              height: 1px;
              background: #3e3e42;
              margin: 15px 0;
            }
            .tip {
              font-size: 11px;
              color: #888;
              padding: 8px;
              background: #1e1e1e;
              border-radius: 4px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <h2>📊 Flow Visualizer</h2>
          <button onclick="sendCommand('analyze')">🔍 Analyze Project</button>
          <button onclick="sendCommand('showFlow')">📈 Show Request Flow</button>
          <button onclick="sendCommand('export')">📥 Export Analysis</button>
          
          <div class="divider"></div>
          
          <div class="tip">
            💡 Tip: Right-click on files to analyze specific routes.
          </div>

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
}