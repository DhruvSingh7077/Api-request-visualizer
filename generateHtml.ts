import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalysis } from './projectAnalyzer';
import { GeneratedDiagrams } from './diagramGenerator';

/**
 * Simple HTML generator - minimal and clean
 */
export async function generateHTML(
  analysis: ProjectAnalysis,
  diagrams: GeneratedDiagrams,
  outputDir: string
): Promise<string> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const indexHtml = createIndexPage(analysis, diagrams);
  const indexPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(indexPath, indexHtml);

  return indexPath;
}

/**
 * Create a single index page with all diagrams
 */
function createIndexPage(
  analysis: ProjectAnalysis,
  diagrams: GeneratedDiagrams
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flow Visualizer - ${analysis.framework}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      background: #1e1e1e;
      color: #e0e0e0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      padding: 40px 20px;
    }

    .container { max-width: 1200px; margin: 0 auto; }

    header {
      text-align: center;
      margin-bottom: 50px;
      border-bottom: 2px solid #333;
      padding-bottom: 30px;
    }

    h1 {
      color: #4ec9b0;
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    .subtitle {
      color: #888;
      font-size: 1.1em;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 50px;
    }

    .stat-card {
      background: #252526;
      padding: 20px;
      border-left: 4px solid #007acc;
      border-radius: 6px;
      text-align: center;
    }

    .stat-card .icon {
      font-size: 2em;
      margin-bottom: 10px;
    }

    .stat-card .number {
      font-size: 2em;
      color: #4ec9b0;
      font-weight: bold;
      margin: 10px 0;
    }

    .stat-card .label {
      color: #888;
      font-size: 0.9em;
    }

    .section {
      background: #252526;
      padding: 30px;
      margin-bottom: 30px;
      border-left: 4px solid #007acc;
      border-radius: 6px;
    }

    .section h2 {
      color: #4ec9b0;
      margin-bottom: 20px;
      font-size: 1.8em;
    }

    .mermaid {
      background: #1e1e1e;
      padding: 20px;
      border-radius: 4px;
      overflow-x: auto;
    }

    .routes-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }

    .routes-table th,
    .routes-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #333;
    }

    .routes-table th {
      background: #1e1e1e;
      color: #4ec9b0;
      font-weight: bold;
    }

    .method-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 3px;
      font-size: 0.85em;
      font-weight: bold;
      color: white;
    }

    .method-get { background: #61affe; }
    .method-post { background: #49cc90; }
    .method-put { background: #fca130; }
    .method-delete { background: #f93e3e; }

    .route-path {
      font-family: 'Courier New', monospace;
      color: #4ec9b0;
    }

    footer {
      text-align: center;
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px solid #333;
      color: #888;
      font-size: 0.9em;
    }

    @media (max-width: 768px) {
      body { padding: 20px 10px; }
      h1 { font-size: 1.8em; }
      .stats-grid { grid-template-columns: 1fr; }
      .section { padding: 15px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🏗️ Flow Visualizer</h1>
      <p class="subtitle">API Request Flow Architecture for ${analysis.framework.toUpperCase()}</p>
    </header>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="icon">🛣️</div>
        <div class="number">${analysis.routes.length}</div>
        <div class="label">Routes</div>
      </div>
      <div class="stat-card">
        <div class="icon">🎮</div>
        <div class="number">${analysis.controllers.length}</div>
        <div class="label">Controllers</div>
      </div>
      <div class="stat-card">
        <div class="icon">⚙️</div>
        <div class="number">${analysis.services.length}</div>
        <div class="label">Services</div>
      </div>
      <div class="stat-card">
        <div class="icon">🛡️</div>
        <div class="number">${analysis.middleware.length}</div>
        <div class="label">Middleware</div>
      </div>
      <div class="stat-card">
        <div class="icon">🗄️</div>
        <div class="number">${analysis.queries.length}</div>
        <div class="label">DB Queries</div>
      </div>
      <div class="stat-card">
        <div class="icon">📁</div>
        <div class="number">${analysis.framework}</div>
        <div class="label">Framework</div>
      </div>
    </div>

    <!-- Architecture Diagram -->
    <div class="section">
      <h2>📊 Architecture Overview</h2>
      <div class="mermaid">
${diagrams.architecture}
      </div>
    </div>

    <!-- Request Flow Diagram -->
    <div class="section">
      <h2>📈 Sample Request Flow</h2>
      <div class="mermaid">
${diagrams.requestFlow}
      </div>
    </div>

    <!-- Routes Table -->
    <div class="section">
      <h2>🛣️ Routes (${analysis.routes.length})</h2>
      <table class="routes-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Controller</th>
            <th>Services</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.routes
            .slice(0, 10)
            .map(
              (route) => \`
          <tr>
            <td><span class="method-badge method-\${route.method.toLowerCase()}">\${route.method}</span></td>
            <td><code class="route-path">\${route.path}</code></td>
            <td>\${route.controller || '-'}</td>
            <td>\${route.services.join(', ') || '-'}</td>
          </tr>
            \`
            )
            .join('')}
        </tbody>
      </table>
      \${analysis.routes.length > 10 ? \`<p style="margin-top: 15px; color: #888;">... and \${analysis.routes.length - 10} more routes</p>\` : ''}
    </div>

    <!-- Services Table -->
    \${analysis.services.length > 0 ? \`
    <div class="section">
      <h2>⚙️ Services (${analysis.services.length})</h2>
      <table class="routes-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Methods</th>
            <th>Dependencies</th>
            <th>DB Calls</th>
          </tr>
        </thead>
        <tbody>
          \${analysis.services
            .slice(0, 10)
            .map(
              (service) => \`
          <tr>
            <td><strong>\${service.name}</strong></td>
            <td>\${service.methods.length}</td>
            <td>\${service.dependencies.length}</td>
            <td>\${service.databaseCalls.length}</td>
          </tr>
            \`
            )
            .join('')}
        </tbody>
      </table>
    </div>
    \` : ''}

    <!-- Dependency Diagram -->
    \${analysis.controllers.length > 0 || analysis.services.length > 0 ? \`
    <div class="section">
      <h2>🔗 Dependencies</h2>
      <div class="mermaid">
${diagrams.dependencyGraph}
      </div>
    </div>
    \` : ''}

    <!-- Middleware Diagram -->
    \${analysis.middleware.length > 0 ? \`
    <div class="section">
      <h2>🛡️ Middleware Chain</h2>
      <div class="mermaid">
${diagrams.middlewareChain}
      </div>
    </div>
    \` : ''}

    <footer>
      <p>Generated by Flow Visualizer • Visualize your API architecture</p>
    </footer>
  </div>

  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'dark' });
    mermaid.contentLoaded();
  </script>
</body>
</html>
  `;
}