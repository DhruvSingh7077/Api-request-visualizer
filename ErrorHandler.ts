/**
 * Enhanced centralized error handling with retry logic and recovery
 */

import { logger } from './logger';

export class FlowVisualizerError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
    public statusCode: number = 500,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'FlowVisualizerError';
    Object.setPrototypeOf(this, FlowVisualizerError.prototype);
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
  FILE_READ_FAILED: 'FILE_READ_FAILED',
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  TIMEOUT: 'TIMEOUT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  MEMORY_ERROR: 'MEMORY_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export class ErrorHandler {
  private static readonly ERROR_MESSAGES: { [key: string]: string } = {
    [ErrorCodes.PROJECT_NOT_FOUND]: '📁 Project path not found. Please check the path exists.',
    [ErrorCodes.INVALID_PROJECT]: '❌ Invalid project structure. Ensure package.json exists.',
    [ErrorCodes.FRAMEWORK_NOT_DETECTED]: '🤔 Framework not detected. Supported: Express, NestJS, Next.js',
    [ErrorCodes.ANALYSIS_FAILED]: '⚙️ Analysis failed. Check project structure and try again.',
    [ErrorCodes.DIAGRAM_GENERATION_FAILED]: '📊 Diagram generation failed. Check data format.',
    [ErrorCodes.HTML_GENERATION_FAILED]: '🎨 HTML generation failed. Check write permissions.',
    [ErrorCodes.FILE_WRITE_FAILED]: '💾 Failed to write files. Check disk space and permissions.',
    [ErrorCodes.FILE_READ_FAILED]: '📖 Failed to read file. Check file exists and permissions.',
    [ErrorCodes.INVALID_OPTIONS]: '⚙️ Invalid options provided. Check configuration.',
    [ErrorCodes.TIMEOUT]: '⏱️ Operation timed out. Try with a smaller project.',
    [ErrorCodes.PERMISSION_DENIED]: '🔒 Permission denied. Check file/folder permissions.',
    [ErrorCodes.MEMORY_ERROR]: '💥 Out of memory. Try with a smaller project.',
    [ErrorCodes.NETWORK_ERROR]: '🌐 Network error. Check internet connection.',
    [ErrorCodes.PARSE_ERROR]: '🔍 Parse error. Check file format is valid.',
    [ErrorCodes.UNKNOWN_ERROR]: '❌ Unknown error occurred.',
  };

  private static readonly RETRYABLE_ERRORS = [
    ErrorCodes.TIMEOUT,
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.MEMORY_ERROR,
  ];

  static handle(error: unknown, context: string = 'Unknown'): FlowVisualizerError {
    logger.error(`Error in ${context}:`, error);

    if (error instanceof FlowVisualizerError) {
      return error;
    }

    if (error instanceof Error) {
      const code = this.determineErrorCode(error.message);
      return new FlowVisualizerError(
        code,
        `${context}: ${error.message}`,
        { originalError: error, stack: error.stack },
        500,
        this.RETRYABLE_ERRORS.includes(code)
      );
    }

    return new FlowVisualizerError(
      ErrorCodes.UNKNOWN_ERROR,
      `${context}: Unknown error occurred`,
      { originalError: error },
      500,
      false
    );
  }

  static projectNotFound(path: string): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.PROJECT_NOT_FOUND,
      `Project not found at path: ${path}`,
      { path },
      404,
      false
    );
  }

  static invalidProject(reason: string): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.INVALID_PROJECT,
      `Invalid project structure: ${reason}`,
      { reason },
      400,
      false
    );
  }

  static frameworkNotDetected(): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.FRAMEWORK_NOT_DETECTED,
      'Could not detect project framework. Supported: Express, NestJS, Next.js',
      {},
      400,
      false
    );
  }

  static analysisTimeout(): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.TIMEOUT,
      'Analysis took too long to complete. Try with a smaller project.',
      {},
      408,
      true
    );
  }

  static fileWriteFailed(path: string, reason?: string): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.FILE_WRITE_FAILED,
      `Failed to write file: ${path}. ${reason || 'Check permissions and disk space.'}`,
      { path, reason },
      500,
      true
    );
  }

  static fileReadFailed(path: string, reason?: string): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.FILE_READ_FAILED,
      `Failed to read file: ${path}. ${reason || 'Check file exists and permissions.'}`,
      { path, reason },
      500,
      false
    );
  }

  static permissionDenied(resource: string): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.PERMISSION_DENIED,
      `Permission denied accessing: ${resource}. Check file/folder permissions.`,
      { resource },
      403,
      false
    );
  }

  static parseError(type: string, details?: string): FlowVisualizerError {
    return new FlowVisualizerError(
      ErrorCodes.PARSE_ERROR,
      `Failed to parse ${type}. ${details || 'Check format is valid.'}`,
      { type, details },
      400,
      false
    );
  }

  static getErrorMessage(error: FlowVisualizerError): string {
    return this.ERROR_MESSAGES[error.code] || error.message;
  }

  static getFullErrorInfo(error: FlowVisualizerError): {
    code: string;
    message: string;
    userMessage: string;
    details: any;
    retryable: boolean;
  } {
    return {
      code: error.code,
      message: error.message,
      userMessage: this.getErrorMessage(error),
      details: error.details,
      retryable: error.retryable,
    };
  }

  private static determineErrorCode(errorMessage: string): string {
    const message = errorMessage.toLowerCase();

    if (message.includes('enoent') || message.includes('not found')) {
      return ErrorCodes.PROJECT_NOT_FOUND;
    }
    if (message.includes('eacces') || message.includes('permission denied')) {
      return ErrorCodes.PERMISSION_DENIED;
    }
    if (message.includes('enomem') || message.includes('out of memory')) {
      return ErrorCodes.MEMORY_ERROR;
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorCodes.TIMEOUT;
    }
    if (message.includes('parse') || message.includes('syntax')) {
      return ErrorCodes.PARSE_ERROR;
    }
    if (message.includes('network') || message.includes('econnrefused')) {
      return ErrorCodes.NETWORK_ERROR;
    }
    if (message.includes('database') || message.includes('database error')) {
      return ErrorCodes.DATABASE_ERROR;
    }

    return ErrorCodes.UNKNOWN_ERROR;
  }
}

export async function withErrorHandling<T>(
  fn: () => T | Promise<T>,
  context: string = 'Operation',
  maxRetries: number = 0
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    } catch (error) {
      lastError = error;
      const handled = ErrorHandler.handle(error, context);

      if (attempt < maxRetries && handled.retryable) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        logger.warn(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw handled;
      }
    }
  }

  throw ErrorHandler.handle(lastError, context);
}

export function tryCatch<T>(
  fn: () => T,
  defaultValue: T,
  context: string = 'Operation'
): T {
  try {
    return fn();
  } catch (error) {
    logger.warn(`${context} failed, returning default value`, error);
    return defaultValue;
  }
}

export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  context: string = 'Operation'
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.warn(`${context} failed, returning default value`, error);
    return defaultValue;
  }
}