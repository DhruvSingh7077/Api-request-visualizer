/**
 * Centralized error handling and recovery
 */

import { logger } from './logger';

export class FlowVisualizerError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FlowVisualizerError';
  }
}

export const ErrorCodes = {
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  INVALID_PROJECT: 'INVALID_PROJECT',
  FRAMEWORK_NOT_DETECTED: 'FRAMEWORK_NOT_DETECTED',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  DIAGRAM_GENERATION_FAILED: 'DIAGRAM_GENERATION_FAILED',
  HTML_GENERATION_FAILED: 'HTML_GENERATION_FAILED',
  FILE_WRITE_FAILED: 'FILE_WRITE_FAILED',
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export class ErrorHandler {
  static handle(error: unknown, context: string = 'Unknown'): FlowVisualizerError {
    logger.error(`Error in ${context}:`, error);

    if (error instanceof FlowVisualizerError) {
      return error;
    }

    if (error instanceof Error) {
      return new FlowVisualizerError(
        ErrorCodes.UNKNOWN_ERROR,
        `${context}: ${error.message}`,
        { originalError: error }
      );
    }

    return new FlowVisualizerError(
      ErrorCodes.UNKNOWN_ERROR,
      `${context}: Unknown error occurred`,
      { originalError: error }
    );
  }

  static projectNotFound(path: string): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.PROJECT_NOT_FOUND,
      `Project not found at path: ${path}`
    );
  }

  static invalidProject(reason: string): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.INVALID_PROJECT,
      `Invalid project structure: ${reason}`
    );
  }

  static frameworkNotDetected(): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.FRAMEWORK_NOT_DETECTED,
      'Could not detect project framework. Supported: Express, NestJS, Next.js'
    );
  }

  static analysisTimeout(): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.TIMEOUT,
      'Analysis took too long to complete'
    );
  }

  static getErrorMessage(error: FlowVisualizerError): string {
    const messages: { [key: string]: string } = {
      [ErrorCodes.PROJECT_NOT_FOUND]: '📁 Project path not found',
      [ErrorCodes.INVALID_PROJECT]: '❌ Project structure is invalid',
      [ErrorCodes.FRAMEWORK_NOT_DETECTED]: '🤔 Framework not detected',
      [ErrorCodes.ANALYSIS_FAILED]: '⚙️ Analysis failed',
      [ErrorCodes.DIAGRAM_GENERATION_FAILED]: '📊 Diagram generation failed',
      [ErrorCodes.HTML_GENERATION_FAILED]: '🎨 HTML generation failed',
      [ErrorCodes.FILE_WRITE_FAILED]: '💾 Failed to write files',
      [ErrorCodes.INVALID_OPTIONS]: '⚙️ Invalid options provided',
      [ErrorCodes.TIMEOUT]: '⏱️ Operation timed out',
      [ErrorCodes.UNKNOWN_ERROR]: '❌ Unknown error occurred',
    };

    return messages[error.code] || error.message;
  }
}

export function withErrorHandling<T>(
  fn: () => T | Promise<T>,
  context: string = 'Operation'
): T | Promise<T> {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.catch((error) => {
        throw ErrorHandler.handle(error, context);
      });
    }
    return result;
  } catch (error) {
    throw ErrorHandler.handle(error, context);
  }
}