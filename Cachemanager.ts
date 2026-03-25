/**
 * Advanced Cache Manager (LRU + TTL + Persistent + Async सुरक्षित)
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheDir: string;
  private persistentCache: boolean;
  private maxSize: number;

  private hits = 0;
  private misses = 0;

  constructor(
    cacheDir: string = '.flow-visualizer-cache',
    persistent: boolean = true,
    maxSize: number = 1000,
    private serializer: (data: any) => string = JSON.stringify,
    private deserializer: (data: string) => any = JSON.parse
  ) {
    this.cacheDir = cacheDir;
    this.persistentCache = persistent;
    this.maxSize = maxSize;

    if (persistent && !fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      logger.debug('Cache directory created', { path: cacheDir });
    }

    if (persistent) {
      this.loadFromDisk();
    }

    // Auto cleanup every 1 min
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  // ---------------- SET ----------------
  async set<T>(key: string, value: T, ttlMs: number = 3600000): Promise<void> {
    // LRU eviction
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      await this.delete(oldestKey);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttlMs,
    };

    this.cache.set(key, entry);
    logger.debug(`Cache set: ${key}`);

    if (this.persistentCache) {
      await this.saveToDisk(key, entry);
    }
  }

  // ---------------- GET ----------------
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    // LRU update
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hits++;
    logger.debug(`Cache hit: ${key}`);

    return entry.value as T;
  }

  // ---------------- HAS ----------------
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  // ---------------- DELETE ----------------
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    logger.debug(`Cache deleted: ${key}`, { success: deleted });

    if (this.persistentCache && deleted) {
      const cacheFile = path.join(this.cacheDir, `${this.sanitizeKey(key)}.json`);
      try {
        await fs.promises.unlink(cacheFile);
      } catch (_) {}
    }

    return deleted;
  }

  // ---------------- CLEAR ----------------
  async clear(): Promise<void> {
    this.cache.clear();
    logger.info('Cache cleared');

    if (this.persistentCache) {
      const files = await fs.promises.readdir(this.cacheDir);
      await Promise.all(
        files.map(file =>
          fs.promises.unlink(path.join(this.cacheDir, file))
        )
      );
    }
  }

  // ---------------- HELPERS ----------------
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  // ---------------- DISK OPS ----------------
  private async saveToDisk(key: string, entry: CacheEntry<any>): Promise<void> {
    try {
      const filename = `${this.sanitizeKey(key)}.json`;
      const filepath = path.join(this.cacheDir, filename);
      await fs.promises.writeFile(filepath, this.serializer(entry));
      logger.debug(`Cache persisted: ${filename}`);
    } catch (error) {
      logger.warn('Failed to persist cache', error);
    }
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) return;

      const files = fs.readdirSync(this.cacheDir);
      let loadedCount = 0;

      files.forEach(file => {
        if (file.endsWith('.json')) {
          try {
            const filepath = path.join(this.cacheDir, file);
            const content = fs.readFileSync(filepath, 'utf-8');
            const entry = this.deserializer(content) as CacheEntry<any>;

            if (!this.isExpired(entry)) {
              this.cache.set(entry.key, entry);
              loadedCount++;
            } else {
              fs.unlinkSync(filepath);
            }
          } catch (err) {
            logger.debug(`Failed to load ${file}`, err);
          }
        }
      });

      logger.debug(`Loaded ${loadedCount} cache entries`);
    } catch (error) {
      logger.warn('Failed loading cache', error);
    }
  }

  // ---------------- STATS ----------------
  getStats() {
    let diskUsage = 0;

    if (this.persistentCache && fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      files.forEach(file => {
        const stats = fs.statSync(path.join(this.cacheDir, file));
        diskUsage += stats.size;
      });
    }

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      diskUsage,
      hits: this.hits,
      misses: this.misses,
      hitRate:
        this.hits + this.misses === 0
          ? 0
          : this.hits / (this.hits + this.misses),
    };
  }

  // ---------------- CLEANUP ----------------
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    logger.debug(`Cleanup removed ${removed} expired items`);
  }

  // ---------------- UTILS ----------------
  getSize(): number {
    return this.cache.size;
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Factory
export const createCacheManager = (
  cacheDir?: string,
  persistent?: boolean,
  maxSize?: number
): CacheManager => {
  return new CacheManager(cacheDir, persistent, maxSize);
};