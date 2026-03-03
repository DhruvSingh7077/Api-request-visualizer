import { ProjectAnalysis, Route, Controller, Service } from './projectAnalyzer';

export interface DiagramOptions {
  format?: 'mermaid' | 'svg';
  interactive?: boolean;
  theme?: 'light' | 'dark';
}

export interface GeneratedDiagrams {
  architecture: string;
  requestFlow: string;
  dependencyGraph: string;
  middlewareChain: string;
  serviceFlow: string;
  databaseFlow: string;
}

/**
 * Generate all diagrams from project analysis
 */
export function generateDiagrams(
  analysis: ProjectAnalysis,
  options: DiagramOptions = {}
): GeneratedDiagrams {
  const { format = 'mermaid', theme = 'dark' } = options;

  return {
    architecture: generateArchitectureDiagram(analysis),
    requestFlow: generateRequestFlowDiagram(analysis),
    dependencyGraph: generateDependencyGraph(analysis),
    middlewareChain: generateMiddlewareChainDiagram(analysis),
    serviceFlow: generateServiceFlowDiagram(analysis),
    databaseFlow: generateDatabaseFlowDiagram(analysis),
  };
}

/**
 * Generate overall architecture diagram
 */
function generateArchitectureDiagram(analysis: ProjectAnalysis): string {
  let mermaid = `graph LR\n`;

  mermaid += `  HTTP["🌐 HTTP Requests"]\n`;
  mermaid += `  Router["🔀 Router<br/>(${analysis.routes.length} routes)"]\n`;
  mermaid += `  HTTP --> Router\n`;

  if (analysis.controllers.length > 0) {
    mermaid += `  Controllers["🎮 Controllers<br/>(${analysis.controllers.length})"]\n`;
    mermaid += `  Router --> Controllers\n`;
  }

  if (analysis.services.length > 0) {
    mermaid += `  Services["⚙️ Services<br/>(${analysis.services.length})"]\n`;
    if (analysis.controllers.length > 0) {
      mermaid += `  Controllers --> Services\n`;
    } else {
      mermaid += `  Router --> Services\n`;
    }
  }

  if (analysis.middleware.length > 0) {
    mermaid += `  Middleware["🛡️ Middleware<br/>(${analysis.middleware.length})"]\n`;
    mermaid += `  HTTP --> Middleware\n`;
    mermaid += `  Middleware --> Router\n`;
  }

  if (analysis.queries.length > 0) {
    mermaid += `  Database["🗄️ Database<br/>(${analysis.queries.length} queries)"]\n`;
    if (analysis.services.length > 0) {
      mermaid += `  Services --> Database\n`;
    } else if (analysis.controllers.length > 0) {
      mermaid += `  Controllers --> Database\n`;
    }
  }

  mermaid += `  Response["📤 Response"]\n`;
  if (analysis.services.length > 0) {
    mermaid += `  Services --> Response\n`;
  } else if (analysis.controllers.length > 0) {
    mermaid += `  Controllers --> Response\n`;
  } else {
    mermaid += `  Router --> Response\n`;
  }

  return mermaid;
}

/**
 * Generate request flow diagram
 */
function generateRequestFlowDiagram(analysis: ProjectAnalysis): string {
  if (analysis.routes.length === 0) {
    return `graph LR\n  A["No routes found"]\n`;
  }

  let mermaid = `graph LR\n`;
  const route = analysis.routes[0];
  let step = 1;

  mermaid += `  S${step}["📨 ${route.method} ${route.path}"]\n`;
  step++;

  if (route.middleware.length > 0) {
    route.middleware.forEach((middleware) => {
      mermaid += `  S${step}["🔐 ${middleware}"]\n`;
      mermaid += `  S${step - 1} --> S${step}\n`;
      step++;
    });
  }

  if (route.controller) {
    mermaid += `  S${step}["🎮 ${route.controller}"]\n`;
    mermaid += `  S${step - 1} --> S${step}\n`;
    step++;
  }

  if (route.services.length > 0) {
    route.services.forEach((service) => {
      mermaid += `  S${step}["⚙️ ${service}"]\n`;
      mermaid += `  S${step - 1} --> S${step}\n`;
      step++;
    });
  }

  if (analysis.queries.length > 0) {
    mermaid += `  S${step}["🗄️ Database Query"]\n`;
    mermaid += `  S${step - 1} --> S${step}\n`;
    step++;
  }

  mermaid += `  S${step}["📤 Response"]\n`;
  mermaid += `  S${step - 1} --> S${step}\n`;

  return mermaid;
}

/**
 * Generate dependency graph
 */
function generateDependencyGraph(analysis: ProjectAnalysis): string {
  let mermaid = `graph LR\n`;
  const processed = new Set<string>();

  analysis.controllers.forEach((controller) => {
    const ctrlId = sanitizeId(controller.name);
    if (!processed.has(ctrlId)) {
      mermaid += `  ${ctrlId}["${controller.name}"]\n`;
      processed.add(ctrlId);

      controller.dependencies.forEach((dep) => {
        const depId = sanitizeId(dep);
        mermaid += `  ${ctrlId} --> ${depId}["${dep}"]\n`;
        processed.add(depId);
      });
    }
  });

  analysis.services.forEach((service) => {
    const svcId = sanitizeId(service.name);
    if (!processed.has(svcId)) {
      mermaid += `  ${svcId}["${service.name}"]\n`;
      processed.add(svcId);

      service.dependencies.forEach((dep) => {
        const depId = sanitizeId(dep);
        mermaid += `  ${svcId} --> ${depId}["${dep}"]\n`;
        processed.add(depId);
      });
    }
  });

  if (processed.size === 0) {
    mermaid += `  A["No dependencies found"]\n`;
  }

  return mermaid;
}

/**
 * Generate middleware chain diagram
 */
function generateMiddlewareChainDiagram(analysis: ProjectAnalysis): string {
  if (analysis.middleware.length === 0) {
    return `graph LR\n  A["No middleware found"]\n`;
  }

  let mermaid = `graph LR\n`;
  mermaid += `  Request["📨 Request"]\n`;

  let step = 1;
  let prevNode = 'Request';

  analysis.middleware.forEach((middleware) => {
    const mwId = `MW${step}`;
    mermaid += `  ${mwId}["${middleware.name}"]\n`;
    mermaid += `  ${prevNode} --> ${mwId}\n`;
    prevNode = mwId;
    step++;
  });

  mermaid += `  Handler["🎯 Handler"]\n`;
  mermaid += `  ${prevNode} --> Handler\n`;
  mermaid += `  Handler --> Response["📤 Response"]\n`;

  return mermaid;
}

/**
 * Generate service flow diagram
 */
function generateServiceFlowDiagram(analysis: ProjectAnalysis): string {
  if (analysis.services.length === 0) {
    return `graph LR\n  A["No services found"]\n`;
  }

  let mermaid = `graph LR\n`;

  analysis.services.forEach((service) => {
    const svcId = sanitizeId(service.name);
    mermaid += `  ${svcId}["${service.name}"]\n`;
  });

  analysis.services.forEach((service) => {
    const svcId = sanitizeId(service.name);
    service.dependencies.forEach((dep) => {
      const depService = analysis.services.find((s) => s.name === dep);
      if (depService) {
        const depId = sanitizeId(dep);
        mermaid += `  ${svcId} -->|calls| ${depId}\n`;
      }
    });
  });

  if (analysis.queries.length > 0) {
    mermaid += `  DB["🗄️ Database"]\n`;
    analysis.services.forEach((service) => {
      if (service.databaseCalls.length > 0) {
        const svcId = sanitizeId(service.name);
        mermaid += `  ${svcId} -->|queries| DB\n`;
      }
    });
  }

  return mermaid;
}

/**
 * Generate database flow diagram
 */
function generateDatabaseFlowDiagram(analysis: ProjectAnalysis): string {
  if (analysis.queries.length === 0) {
    return `graph LR\n  A["No database calls found"]\n`;
  }

  let mermaid = `graph LR\n`;
  mermaid += `  App["📱 Application"]\n`;
  mermaid += `  DB["🗄️ Database"]\n`;
  mermaid += `  App -->|${analysis.queries.length} queries| DB\n`;

  return mermaid;
}

/**
 * Sanitize IDs for Mermaid
 */
function sanitizeId(str: string): string {
  return str.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50);
}

/**
 * Generate HTML wrapper for diagrams
 */
export function generateMermaidHTML(diagrams: GeneratedDiagrams): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flow Visualizer</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
  <style>
    body { background: #1e1e1e; color: #e0e0e0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #4ec9b0; margin-bottom: 30px; }
    .diagram-section { background: #252526; padding: 25px; margin-bottom: 30px; border-left: 4px solid #007acc; border-radius: 6px; }
    .diagram-section h2 { color: #4ec9b0; margin-bottom: 15px; }
    .mermaid { background: #1e1e1e; padding: 15px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏗️ Flow Visualizer - Architecture Diagrams</h1>
    
    <div class="diagram-section">
      <h2>📊 Overall Architecture</h2>
      <div class="mermaid">${diagrams.architecture}</div>
    </div>
    
    <div class="diagram-section">
      <h2>📈 Request Flow</h2>
      <div class="mermaid">${diagrams.requestFlow}</div>
    </div>
    
    <div class="diagram-section">
      <h2>🔗 Dependencies</h2>
      <div class="mermaid">${diagrams.dependencyGraph}</div>
    </div>
    
    <div class="diagram-section">
      <h2>🛡️ Middleware Chain</h2>
      <div class="mermaid">${diagrams.middlewareChain}</div>
    </div>
    
    <div class="diagram-section">
      <h2>⚙️ Services</h2>
      <div class="mermaid">${diagrams.serviceFlow}</div>
    </div>
    
    <div class="diagram-section">
      <h2>🗄️ Database</h2>
      <div class="mermaid">${diagrams.databaseFlow}</div>
    </div>
  </div>
  
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'dark' });
    mermaid.contentLoaded();
  <\/script>
</body>
</html>
  `;
}