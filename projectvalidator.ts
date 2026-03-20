/**
 * Enhanced project analyzer with better error handling and validation
 */

import fs from 'fs';
import path from 'path';
import { Project } from 'ts-morph';
import { logger } from './logger';
import { ErrorHandler, withErrorHandling } from './errorHandler';
import { FileUtils, StringUtils, TimeUtils, ValidationUtils } from './utils';

export interface Route {
  path: string;
  method: string;
  handler: string;
  controller?: string;
  middleware: string[];
  services: string[];
  description?: string;
  params?: string[];
  queries?: string[];
}

export interface Controller {
  name: string;
  file: string;
  routes: Route[];
  methods: ControllerMethod[];
  dependencies: string[];
}

export interface ControllerMethod {
  name: string;
  type: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path?: string;
  middleware?: string[];
}

export interface Service {
  name: string;
  file: string;
  methods: ServiceMethod[];
  dependencies: string[];
  databaseCalls: DatabaseCall[];
}

export interface ServiceMethod {
  name: string;
  returnType?: string;
  parameters?: string[];
}

export interface DatabaseCall {
  type: string;
  model?: string;
  operation: string;
  location: string;
}

export interface Middleware {
  name: string;
  file: string;
  type: 'global' | 'route' | 'class';
  appliedTo?: string[];
}

export interface ProjectAnalysis {
  framework: string;
  routes: Route[];
  controllers: Controller[];
  services: Service[];
  middleware: Middleware[];
  queries: DatabaseCall[];
  dependencies: Map<string, string[]>;
  fileStructure: FileNode;
  analysisMetrics: AnalysisMetrics;
}

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

export interface AnalysisMetrics {
  totalFilesScanned: number;
  analysisTimeMs: number;
  successRate: number;
  errors: string[];
  warnings: string[];
}

export interface AnalysisOptions {
  framework?: 'express' | 'nestjs' | 'nextjs' | 'auto';
  includeDatabase?: boolean;
  includeMiddleware?: boolean;
  includeServices?: boolean;
  excludePatterns?: string[];
  timeout?: number;
  maxFiles?: number;
}

/**
 * Main analysis function with enhanced error handling
 */
export async function analyzeProject(
  projectPath: string,
  options: AnalysisOptions = {}
): Promise<ProjectAnalysis> {
  const startTime = Date.now();
  const metrics: AnalysisMetrics = {
    totalFilesScanned: 0,
    analysisTimeMs: 0,
    successRate: 100,
    errors: [],
    warnings: [],
  };

  try {
    // Validate inputs
    validateProjectPath(projectPath);
    validateProjectStructure(projectPath);

    const {
      framework = 'auto',
      includeDatabase = true,
      includeMiddleware = true,
      includeServices = true,
      excludePatterns = ['node_modules', 'dist', 'build', '.next'],
      timeout = 30000,
      maxFiles = 1000,
    } = options;

    logger.info('Analysis started', { projectPath, framework, timeout });

    // Detect framework
    let detectedFramework = framework;
    if (framework === 'auto') {
      detectedFramework = detectFramework(projectPath);
      if (!detectedFramework || detectedFramework === 'unknown') {
        metrics.warnings.push('Framework not detected, attempting generic analysis');
      }
    }

    // Create analysis object
    const analysis: ProjectAnalysis = {
      framework: detectedFramework,
      routes: [],
      controllers: [],
      services: [],
      middleware: [],
      queries: [],
      dependencies: new Map(),
      fileStructure: { name: 'root', type: 'directory', path: projectPath },
      analysisMetrics: metrics,
    };

    // Wrap analysis with timeout
    await TimeUtils.timeout(
      performAnalysis(projectPath, analysis, detectedFramework, {
        includeDatabase,
        includeMiddleware,
        includeServices,
        excludePatterns,
        maxFiles,
      }),
      timeout
    );

    // Calculate metrics
    metrics.analysisTimeMs = Date.now() - startTime;
    metrics.successRate = analysis.routes.length > 0 ? 100 : 50;

    logger.info('Analysis completed successfully', {
      routes: analysis.routes.length,
      controllers: analysis.controllers.length,
      services: analysis.services.length,
      timeMs: metrics.analysisTimeMs,
    });

    return analysis;
  } catch (error) {
    metrics.analysisTimeMs = Date.now() - startTime;
    const handled = ErrorHandler.handle(error, 'Project Analysis');
    metrics.errors.push(handled.message);
    logger.error('Analysis failed', handled);
    throw handled;
  }
}

/**
 * Validate project path
 */
function validateProjectPath(projectPath: string): void {
  if (!projectPath) {
    throw ErrorHandler.projectNotFound('(empty path)');
  }

  if (!FileUtils.directoryExists(projectPath)) {
    throw ErrorHandler.projectNotFound(projectPath);
  }

  if (!ValidationUtils.isValidPath(projectPath)) {
    throw ErrorHandler.invalidProject('Invalid path format');
  }
}

/**
 * Validate project structure
 */
function validateProjectStructure(projectPath: string): void {
  const packageJsonPath = path.join(projectPath, 'package.json');

  if (!FileUtils.fileExists(packageJsonPath)) {
    throw ErrorHandler.invalidProject('package.json not found');
  }

  try {
    const packageJson = JSON.parse(FileUtils.readFile(packageJsonPath));
    if (!packageJson.name) {
      throw ErrorHandler.invalidProject('package.json missing "name" field');
    }
  } catch (error) {
    throw ErrorHandler.parseError('package.json', 'Invalid JSON format');
  }
}

/**
 * Detect framework
 */
function detectFramework(projectPath: string): string {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(FileUtils.readFile(packageJsonPath));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (dependencies['next']) return 'nextjs';
    if (dependencies['@nestjs/common']) return 'nestjs';
    if (dependencies['express']) return 'express';

    return 'unknown';
  } catch (error) {
    logger.warn('Failed to detect framework', error);
    return 'unknown';
  }
}

/**
 * Perform the actual analysis
 */
async function performAnalysis(
  projectPath: string,
  analysis: ProjectAnalysis,
  framework: string,
  options: {
    includeDatabase: boolean;
    includeMiddleware: boolean;
    includeServices: boolean;
    excludePatterns: string[];
    maxFiles: number;
  }
): Promise<void> {
  try {
    // Create ts-morph project
    const tsconfigPath = path.join(projectPath, 'tsconfig.json');
    const tsMorphProject = new Project({
      tsConfigFilePath: FileUtils.fileExists(tsconfigPath) ? tsconfigPath : undefined,
      skipAddingFilesFromTsConfig: true,
    });

    // Get source files
    const srcPath = path.join(projectPath, 'src');
    const sourceFiles = FileUtils.fileExists(srcPath)
      ? tsMorphProject.addSourceFilesAtPaths(path.join(srcPath, '**/*.ts{,x}'))
      : [];

    analysis.analysisMetrics.totalFilesScanned = sourceFiles.length;

    if (sourceFiles.length === 0) {
      analysis.analysisMetrics.warnings.push('No TypeScript files found in src/');
    }

    if (sourceFiles.length > options.maxFiles) {
      analysis.analysisMetrics.warnings.push(
        `Found ${sourceFiles.length} files, analyzing first ${options.maxFiles}`
      );
      sourceFiles.length = options.maxFiles;
    }

    // Analyze based on framework
    switch (framework) {
      case 'express':
        analyzeExpressProject(projectPath, analysis, options);
        break;
      case 'nestjs':
        analyzeNestJSProject(sourceFiles, analysis, options);
        break;
      case 'nextjs':
        analyzeNextJSProject(projectPath, analysis, options);
        break;
      default:
        analyzeGenericProject(projectPath, analysis, options);
    }
  } catch (error) {
    logger.error('Performance analysis failed', error);
    if (error instanceof Error && !error.message.includes('timeout')) {
      throw error;
    }
  }
}

/**
 * Analyze Express project
 */
function analyzeExpressProject(
  projectPath: string,
  analysis: ProjectAnalysis,
  options: any
): void {
  try {
    const srcPath = path.join(projectPath, 'src');
    if (!FileUtils.directoryExists(srcPath)) {
      analysis.analysisMetrics.warnings.push('src/ directory not found');
      return;
    }

    const tsFiles = FileUtils.listFiles(srcPath, '.ts');
    logger.debug(`Found ${tsFiles.length} TypeScript files`);

    // Parse files for Express routes
    tsFiles.forEach((file) => {
      try {
        const content = FileUtils.readFile(file);
        const routes = extractExpressRoutes(content);
        analysis.routes.push(...routes);
      } catch (error) {
        logger.warn(`Failed to parse file: ${file}`, error);
      }
    });
  } catch (error) {
    analysis.analysisMetrics.errors.push(`Express analysis error: ${(error as Error).message}`);
    logger.error('Express project analysis failed', error);
  }
}

/**
 * Analyze NestJS project
 */
function analyzeNestJSProject(
  sourceFiles: any[],
  analysis: ProjectAnalysis,
  options: any
): void {
  try {
    sourceFiles.forEach((sourceFile) => {
      try {
        const classes = sourceFile.getClasses();

        classes.forEach((classDecl: any) => {
          const decorators = classDecl.getDecorators();

          decorators.forEach((decorator: any) => {
            const name = decorator.getName();
            if (name === 'Controller') {
              const controller = extractNestJSController(classDecl);
              if (controller) {
                analysis.controllers.push(controller);
                analysis.routes.push(...controller.routes);
              }
            }
            if (name === 'Injectable' && options.includeServices) {
              const service = extractNestJSService(classDecl);
              if (service) {
                analysis.services.push(service);
              }
            }
          });
        });
      } catch (error) {
        logger.warn(`Failed to analyze source file`, error);
      }
    });
  } catch (error) {
    analysis.analysisMetrics.errors.push(`NestJS analysis error: ${(error as Error).message}`);
    logger.error('NestJS project analysis failed', error);
  }
}

/**
 * Analyze Next.js project
 */
function analyzeNextJSProject(
  projectPath: string,
  analysis: ProjectAnalysis,
  options: any
): void {
  try {
    const apiDir = path.join(projectPath, 'app/api');
    if (FileUtils.directoryExists(apiDir)) {
      const apiFiles = FileUtils.listFiles(apiDir, '.ts');
      apiFiles.forEach((file) => {
        try {
          const routes = extractNextJSRoutes(file, projectPath);
          analysis.routes.push(...routes);
        } catch (error) {
          logger.warn(`Failed to parse Next.js file: ${file}`, error);
        }
      });
    }
  } catch (error) {
    analysis.analysisMetrics.errors.push(`Next.js analysis error: ${(error as Error).message}`);
    logger.error('Next.js project analysis failed', error);
  }
}

/**
 * Generic project analysis
 */
function analyzeGenericProject(
  projectPath: string,
  analysis: ProjectAnalysis,
  options: any
): void {
  try {
    const srcPath = path.join(projectPath, 'src');
    if (FileUtils.directoryExists(srcPath)) {
      const tsFiles = FileUtils.listFiles(srcPath, '.ts');
      logger.info(`Analyzing ${tsFiles.length} TypeScript files`);

      tsFiles.slice(0, 50).forEach((file) => {
        try {
          const content = FileUtils.readFile(file);
          const routes = extractExpressRoutes(content);
          analysis.routes.push(...routes);
        } catch (error) {
          logger.debug(`Failed to parse generic file: ${file}`);
        }
      });
    }
  } catch (error) {
    logger.warn('Generic project analysis partial failure', error);
  }
}

/**
 * Extract Express routes
 */
function extractExpressRoutes(content: string): Route[] {
  const routes: Route[] = [];
  const routeRegex = /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match;

  while ((match = routeRegex.exec(content)) !== null) {
    routes.push({
      path: match[2],
      method: match[1].toUpperCase(),
      handler: 'handler',
      middleware: [],
      services: [],
    });
  }

  return routes;
}

/**
 * Extract NestJS controller
 */
function extractNestJSController(classDecl: any): Controller | null {
  try {
    const name = classDecl.getName() || 'Unknown';
    const file = classDecl.getSourceFile().getFilePath();
    const routes: Route[] = [];
    const methods = classDecl.getMethods();

    methods.forEach((method: any) => {
      const methodDecorators = method.getDecorators();
      methodDecorators.forEach((decorator: any) => {
        const httpMethod = decorator.getName();
        if (['Get', 'Post', 'Put', 'Delete', 'Patch'].includes(httpMethod)) {
          routes.push({
            path: '',
            method: httpMethod.toUpperCase(),
            handler: method.getName() || '',
            controller: name,
            middleware: [],
            services: [],
          });
        }
      });
    });

    return { name, file, routes, methods: [], dependencies: [] };
  } catch (error) {
    logger.warn('Failed to extract NestJS controller', error);
    return null;
  }
}

/**
 * Extract NestJS service
 */
function extractNestJSService(classDecl: any): Service | null {
  try {
    const name = classDecl.getName() || 'Unknown';
    const file = classDecl.getSourceFile().getFilePath();
    const methods = classDecl.getMethods();

    return {
      name,
      file,
      methods: methods.map((m: any) => ({
        name: m.getName() || '',
        returnType: m.getReturnTypeNode()?.getText(),
      })),
      dependencies: [],
      databaseCalls: [],
    };
  } catch (error) {
    logger.warn('Failed to extract NestJS service', error);
    return null;
  }
}

/**
 * Extract Next.js routes
 */
function extractNextJSRoutes(filePath: string, projectPath: string): Route[] {
  try {
    const route = filePath
      .replace(projectPath, '')
      .replace(/\.(ts|js)x?$/, '')
      .replace(/\/route$/, '')
      .replace(/\[/, ':')
      .replace(/\]/, '');

    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((method) => ({
      path: route,
      method,
      handler: 'handler',
      middleware: [],
      services: [],
    }));
  } catch (error) {
    logger.warn('Failed to extract Next.js routes', error);
    return [];
  }
}