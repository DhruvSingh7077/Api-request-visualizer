import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
  isValid: boolean;
  framework?: string;
  filesCount: number;
  errors: string[];
  warnings: string[];
}

/**
 * Validate project structure
 */
export function validateProject(projectPath: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    filesCount: 0,
    errors: [],
    warnings: [],
  };

  // Check if path exists
  if (!fs.existsSync(projectPath)) {
    result.isValid = false;
    result.errors.push('Project path does not exist');
    return result;
  }

  // Check for package.json
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    result.isValid = false;
    result.errors.push('package.json not found');
    return result;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Detect framework
    if (dependencies['next']) {
      result.framework = 'nextjs';
    } else if (dependencies['@nestjs/common']) {
      result.framework = 'nestjs';
    } else if (dependencies['express']) {
      result.framework = 'express';
    } else {
      result.warnings.push('No supported framework detected. Supported: Express, NestJS, Next.js');
    }

    // Count source files
    const srcPath = path.join(projectPath, 'src');
    if (fs.existsSync(srcPath)) {
      result.filesCount = countFiles(srcPath);
    } else {
      result.warnings.push('No src/ directory found');
    }

    // Check for TypeScript
    if (!fs.existsSync(path.join(projectPath, 'tsconfig.json'))) {
      result.warnings.push('No tsconfig.json found. TypeScript project recommended');
    }

    // Check for node_modules
    if (!fs.existsSync(path.join(projectPath, 'node_modules'))) {
      result.warnings.push('Dependencies not installed. Run: npm install');
    }
  } catch (error) {
    result.isValid = false;
    result.errors.push(`Failed to parse package.json: ${(error as Error).message}`);
  }

  return result;
}

/**
 * Count files recursively
 */
function countFiles(dirPath: string, count: number = 0): number {
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      if (file.startsWith('.') || file === 'node_modules') continue;

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        count = countFiles(fullPath, count);
      } else {
        count++;
      }
    }
  } catch {
    // Handle permission errors
  }
  return count;
}