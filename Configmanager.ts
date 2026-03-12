/**
 * Configuration management with validation and defaults
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface FlowVisualizerConfig {
  framework: 'express' | 'nestjs' | 'nextjs' | 'auto';
  include: {
    database: boolean;
    middleware: boolean;
    services: boolean;
  };
  output: string;
  exclude: string[];
  autoOpenBrowser: boolean;
  maxDepth: number;
  timeout: number;
  verbose: boolean;
  theme: 'light' | 'dark' | 'auto';
}

const DEFAULT_CONFIG: FlowVisualizerConfig = {
  framework: 'auto',
  include: {
    database: true,
    middleware: true,
    services: true,
  },
  output: '.flow-visualizer',
  exclude: ['node_modules', 'dist', 'build', '.next', '.nuxt', 'coverage'],
  autoOpenBrowser: true,
  maxDepth: 5,
  timeout: 30000,
  verbose: false,
  theme: 'dark',
};

export class ConfigManager {
  private config: FlowVisualizerConfig;
  private configPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.configPath = path.join(projectPath, '.api-flow-config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): FlowVisualizerConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const userConfig = JSON.parse(content);
        logger.debug('Config file loaded', { path: this.configPath });
        return { ...DEFAULT_CONFIG, ...userConfig };
      }
    } catch (error) {
      logger.warn('Failed to load config file, using defaults', { error });
    }

    return { ...DEFAULT_CONFIG };
  }

  getConfig(): FlowVisualizerConfig {
    return { ...this.config };
  }

  getOption<K extends keyof FlowVisualizerConfig>(key: K): FlowVisualizerConfig[K] {
    return this.config[key];
  }

  setOption<K extends keyof FlowVisualizerConfig>(
    key: K,
    value: FlowVisualizerConfig[K]
  ): void {
    this.config[key] = value;
    logger.debug(`Config option updated: ${key} = ${JSON.stringify(value)}`);
  }

  mergeConfig(partial: Partial<FlowVisualizerConfig>): void {
    this.config = { ...this.config, ...partial };
    logger.debug('Config merged', { partial });
  }

  saveConfig(): void {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2)
      );
      logger.info('Config file saved', { path: this.configPath });
    } catch (error) {
      logger.error('Failed to save config file', error);
    }
  }

  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
    logger.info('Config reset to defaults');
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.output || typeof this.config.output !== 'string') {
      errors.push('Invalid output directory');
    }

    if (!Array.isArray(this.config.exclude)) {
      errors.push('Invalid exclude patterns');
    }

    if (this.config.maxDepth < 1 || this.config.maxDepth > 10) {
      errors.push('maxDepth must be between 1 and 10');
    }

    if (this.config.timeout < 1000 || this.config.timeout > 300000) {
      errors.push('timeout must be between 1000ms and 300000ms');
    }

    if (!['express', 'nestjs', 'nextjs', 'auto'].includes(this.config.framework)) {
      errors.push('Invalid framework specified');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getExcludePatterns(): RegExp[] {
    return this.config.exclude.map((pattern) => {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escaped);
    });
  }

  isFileExcluded(filePath: string): boolean {
    const patterns = this.getExcludePatterns();
    return patterns.some((pattern) => pattern.test(filePath));
  }

  toString(): string {
    return JSON.stringify(this.config, null, 2);
  }
}

export const createConfigManager = (projectPath?: string): ConfigManager => {
  return new ConfigManager(projectPath);
};