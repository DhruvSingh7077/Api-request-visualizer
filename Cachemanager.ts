/**
 * Caching system to improve performance
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheDir: string;
  private persistentCache: boolean;

  constructor(cacheDir: string = '.flow-visualizer-cache', persistent: boolean = true) {
    this.cacheDir = cacheDir;
    this.persistentCache = persistent;

    if (persistent && !fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      logger.debug('Cache directory created', { path: cacheDir });
    }

    if (persistent) {
      this.loadFromDisk();
    }
  }

  set<T>(key: string, value: T, ttlMs: number = 3600000): void {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttlMs,
    };

    this.cache.set(key, entry);
    logger.debug(`Cache set: ${key}`);

    if (this.persistentCache) {
      this.saveToDisk(key, entry);
    }
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key);
      return undefined;
    }

    logger.debug(`Cache hit: ${key}`);
    return entry.value as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    logger.debug(`Cache deleted: ${key}`, { success: deleted });

    if (this.persistentCache && deleted) {
      const cacheFile = path.join(this.cacheDir, `${this.sanitizeKey(key)}.json`);
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
      }
    }

    return deleted;
  }

  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');

    if (this.persistentCache) {
      const files = fs.readdirSync(this.cacheDir);
      files.forEach((file) => {
        fs.unlinkSync(path.join(this.cacheDir, file));
      });
    }
  }

  getSize(): number {
    return this.cache.size;
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private saveToDisk(key: string, entry: CacheEntry<any>): void {
    try {
      const filename = `${this.sanitizeKey(key)}.json`;
      const filepath = path.join(this.cacheDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(entry, null, 2));
      logger.debug(`Cache persisted to disk: ${filename}`);
    } catch (error) {
      logger.warn('Failed to persist cache to disk', error);
    }
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        return;
      }

      const files = fs.readdirSync(this.cacheDir);
      let loadedCount = 0;

      files.forEach((file) => {
        if (file.endsWith('.json')) {
          try {
            const filepath = path.join(this.cacheDir, file);
            const content = fs.readFileSync(filepath, 'utf-8');
            const entry = JSON.parse(content) as CacheEntry<any>;

            // Check if expired
            const now = Date.now();
            if (now - entry.timestamp <= entry.ttl) {
              this.cache.set(entry.key, entry);
              loadedCount++;
            } else {
              fs.unlinkSync(filepath);
            }
          } catch (error) {
            logger.debug(`Failed to load cache file: ${file}`, error);
          }
        }
      });

      logger.debug(`Loaded ${loadedCount} items from disk cache`);
    } catch (error) {
      logger.warn('Failed to load cache from disk', error);
    }
  }

  getStats(): {
    size: number;
    keys: string[];
    diskUsage: number;
  } {
    let diskUsage = 0;

    if (this.persistentCache && fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      files.forEach((file) => {
        const filepath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filepath);
        diskUsage += stats.size;
      });
    }

    return {
      size: this.cache.size,
      keys: this.getKeys(),
      diskUsage,
    };
  }

  cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        this.delete(key);
        removedCount++;
      }
    });

    logger.debug(`Cache cleanup completed: ${removedCount} expired items removed`);
  }
}

export const createCacheManager = (
  cacheDir?: string,
  persistent?: boolean
): CacheManager => {
  return new CacheManager(cacheDir, persistent);
};