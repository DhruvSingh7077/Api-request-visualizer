/**
 * Utility functions used throughout the project
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

/**
 * File system utilities
 */
export class FileUtils {
  static fileExists(filepath: string): boolean {
    return fs.existsSync(filepath);
  }

  static directoryExists(dirpath: string): boolean {
    try {
      return fs.statSync(dirpath).isDirectory();
    } catch {
      return false;
    }
  }

  static ensureDirectory(dirpath: string): void {
    if (!fs.existsSync(dirpath)) {
      fs.mkdirSync(dirpath, { recursive: true });
      logger.debug(`Directory created: ${dirpath}`);
    }
  }

  static readFile(filepath: string): string {
    try {
      return fs.readFileSync(filepath, 'utf-8');
    } catch (error) {
      logger.error(`Failed to read file: ${filepath}`, error);
      throw error;
    }
  }

  static writeFile(filepath: string, content: string): void {
    try {
      this.ensureDirectory(path.dirname(filepath));
      fs.writeFileSync(filepath, content, 'utf-8');
      logger.debug(`File written: ${filepath}`);
    } catch (error) {
      logger.error(`Failed to write file: ${filepath}`, error);
      throw error;
    }
  }

  static listFiles(dirpath: string, extension?: string): string[] {
    try {
      const files: string[] = [];

      const walkDir = (dir: string) => {
        const entries = fs.readdirSync(dir);

        entries.forEach((entry) => {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (!extension || fullPath.endsWith(extension)) {
            files.push(fullPath);
          }
        });
      };

      walkDir(dirpath);
      return files;
    } catch (error) {
      logger.error(`Failed to list files in: ${dirpath}`, error);
      return [];
    }
  }

  static deleteFile(filepath: string): boolean {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.debug(`File deleted: ${filepath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to delete file: ${filepath}`, error);
      return false;
    }
  }

  static getFileSize(filepath: string): number {
    try {
      return fs.statSync(filepath).size;
    } catch {
      return 0;
    }
  }

  static getFileSizeFormatted(filepath: string): string {
    const bytes = this.getFileSize(filepath);
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

/**
 * String utilities
 */
export class StringUtils {
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static camelToKebab(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  static kebabToCamel(str: string): string {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  static sanitize(str: string): string {
    return str.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  static truncate(str: string, length: number): string {
    return str.length > length ? str.substring(0, length - 3) + '...' : str;
  }

  static isEmpty(str: string | null | undefined): boolean {
    return !str || str.trim().length === 0;
  }

  static removeLeadingSlash(str: string): string {
    return str.startsWith('/') ? str.slice(1) : str;
  }

  static addLeadingSlash(str: string): string {
    return str.startsWith('/') ? str : '/' + str;
  }
}

/**
 * Array utilities
 */
export class ArrayUtils {
  static unique<T>(arr: T[]): T[] {
    return [...new Set(arr)];
  }

  static flatten<T>(arr: T[][]): T[] {
    return arr.reduce((flat, item) => flat.concat(item), []);
  }

  static chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  static groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    arr.forEach((item) => {
      const k = key(item);
      if (!map.has(k)) {
        map.set(k, []);
      }
      map.get(k)!.push(item);
    });
    return map;
  }

  static sortBy<T>(arr: T[], key: (item: T) => any): T[] {
    return [...arr].sort((a, b) => {
      const valA = key(a);
      const valB = key(b);
      return valA < valB ? -1 : valA > valB ? 1 : 0;
    });
  }
}

/**
 * Time utilities
 */
export class TimeUtils {
  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  static formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }

  static async timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), ms)
      ),
    ]);
  }

  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  static isEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidPort(port: string | number): boolean {
    const num = typeof port === 'string' ? parseInt(port, 10) : port;
    return num > 0 && num < 65536;
  }

  static isValidPath(filepath: string): boolean {
    try {
      path.resolve(filepath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Performance utilities
 */
export class PerformanceUtils {
  static measureTime(fn: () => void): number {
    const start = performance.now();
    fn();
    return performance.now() - start;
  }

  static async measureTimeAsync(fn: () => Promise<void>): Promise<number> {
    const start = performance.now();
    await fn();
    return performance.now() - start;
  }

  static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delayMs: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delayMs);
    };
  }

  static memoize<T extends (...args: any[]) => any>(fn: T): T {
    const cache = new Map();
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }
}

/**
 * Object utilities
 */
export class ObjectUtils {
  static isEmpty(obj: any): boolean {
    return Object.keys(obj).length === 0;
  }

  static deepMerge<T>(target: T, source: Partial<T>): T {
    const output = { ...target };
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (
          sourceValue &&
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue) &&
          targetValue &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue)
        ) {
          output[key] = this.deepMerge(targetValue, sourceValue);
        } else {
          output[key] = sourceValue as T[Extract<keyof T, string>];
        }
      }
    }
    return output;
  }

  static pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach((key) => {
      result[key] = obj[key];
    });
    return result;
  }

  static omit<T, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
    const result = { ...obj };
    keys.forEach((key) => {
      delete result[key];
    });
    return result as Omit<T, K>;
  }
}