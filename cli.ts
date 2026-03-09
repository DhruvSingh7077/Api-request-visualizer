#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import { analyzeProject } from './analyzers/projectAnalyzer';
import { generateDiagrams } from './diagram/diagramGenerator';
import { generateHTML } from './html/generateHTML';
import { validateProject } from './validators/projectValidator';

const version = '1.0.0';

program
  .name('flow-visualizer')
  .description('Visualize API request flows and architecture')
  .version(version);

/**
 * ANALYZE COMMAND
 */
program
  .command('analyze')
  .description('Analyze project and generate documentation')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-o, --output <dir>', 'Output directory', '.flow-visualizer')
  .option('-f, --framework <fw>', 'Framework (express, nestjs, nextjs, auto)', 'auto')
  .option('-d, --database', 'Include database analysis', true)
  .option('-m, --middleware', 'Include middleware', true)
  .option('-s, --services', 'Include services', true)
  .action(async (options) => {
    try {
      const spinner = ora();

      // Validate project
      spinner.start('Validating project...');
      const validation = validateProject(options.path);
      
      if (!validation.isValid) {
        spinner.fail('Validation failed');
        validation.errors.forEach(err => {
          console.error(chalk.red(`  ✗ ${err}`));
        });
        process.exit(1);
      }
      spinner.succeed('Project validated');

      // Analyze
      spinner.start('Analyzing project...');
      const analysis = await analyzeProject(options.path, {
        framework: options.framework,
        includeDatabase: options.database,
        includeMiddleware: options.middleware,
        includeServices: options.services,
      });
      spinner.succeed(`Found ${chalk.cyan(analysis.routes.length)} routes`);

      // Generate diagrams
      spinner.start('Generating diagrams...');
      const diagrams = generateDiagrams(analysis);
      spinner.succeed('Diagrams generated');

      // Create output
      const outputDir = path.resolve(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate HTML
      spinner.start('Creating documentation...');
      const htmlPath = await generateHTML(analysis, diagrams, outputDir);
      spinner.succeed('Documentation created');

      // Print summary
      console.log('\n' + chalk.cyan('════════════════════════════════'));
      console.log(chalk.cyan('      ANALYSIS SUMMARY'));
      console.log(chalk.cyan('════════════════════════════════'));
      console.log(`Framework:      ${chalk.yellow(analysis.framework)}`);
      console.log(`Routes:         ${chalk.yellow(analysis.routes.length)}`);
      console.log(`Controllers:    ${chalk.yellow(analysis.controllers.length)}`);
      console.log(`Services:       ${chalk.yellow(analysis.services.length)}`);
      console.log(`Middleware:     ${chalk.yellow(analysis.middleware.length)}`);
      console.log(`DB Queries:     ${chalk.yellow(analysis.queries.length)}`);
      console.log(chalk.cyan('════════════════════════════════\n'));

      console.log(chalk.green('✓ Success! Open the documentation:'));
      console.log(chalk.blue(`  ${htmlPath}\n`));
    } catch (error) {
      console.error(chalk.red('\n✗ Error:'), (error as Error).message);
      process.exit(1);
    }
  });

/**
 * INIT COMMAND
 */
program
  .command('init')
  .description('Create config file')
  .action(() => {
    const config = {
      framework: 'auto',
      output: '.flow-visualizer',
      include: {
        database: true,
        middleware: true,
        services: true,
      },
      exclude: ['node_modules', 'dist', 'build', '.next'],
    };

    fs.writeFileSync('.api-flow-config.json', JSON.stringify(config, null, 2));
    console.log(chalk.green('✓ Config created: .api-flow-config.json'));
  });

/**
 * VALIDATE COMMAND
 */
program
  .command('validate')
  .description('Validate project structure')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action((options) => {
    const validation = validateProject(options.path);

    if (validation.isValid) {
      console.log(chalk.green('✓ Project is valid'));
      if (validation.framework) {
        console.log(`Framework: ${chalk.cyan(validation.framework)}`);
      }
      console.log(`Files: ${chalk.cyan(validation.filesCount)}`);
    } else {
      console.log(chalk.red('✗ Validation failed:'));
      validation.errors.forEach(err => {
        console.log(chalk.red(`  • ${err}`));
      });
    }

    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'));
      validation.warnings.forEach(warn => {
        console.log(chalk.yellow(`  • ${warn}`));
      });
    }
  });

/**
 * EXPORT COMMAND
 */
program
  .command('export')
  .description('Export analysis as JSON')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-o, --output <file>', 'Output file', 'flow-analysis.json')
  .action(async (options) => {
    try {
      const spinner = ora('Exporting analysis...');
      spinner.start();

      const analysis = await analyzeProject(options.path);
      
      const exportData = {
        timestamp: new Date().toISOString(),
        framework: analysis.framework,
        stats: {
          routes: analysis.routes.length,
          controllers: analysis.controllers.length,
          services: analysis.services.length,
          middleware: analysis.middleware.length,
          queries: analysis.queries.length,
        },
        routes: analysis.routes,
        controllers: analysis.controllers,
        services: analysis.services,
      };

      fs.writeFileSync(options.output, JSON.stringify(exportData, null, 2));
      spinner.succeed(`Exported to ${chalk.cyan(options.output)}`);
    } catch (error) {
      console.error(chalk.red('Export failed:'), (error as Error).message);
      process.exit(1);
    }
  });

/**
 * SERVE COMMAND
 */
program
  .command('serve')
  .description('Serve documentation')
  .option('-p, --path <path>', 'Documentation path', '.flow-visualizer')
  .option('--port <num>', 'Port number', '3000')
  .action((options) => {
    if (!fs.existsSync(options.path)) {
      console.error(chalk.red(`Path not found: ${options.path}`));
      console.log(chalk.yellow('Run "flow-visualizer analyze" first'));
      process.exit(1);
    }

    console.log(chalk.green(`✓ Serving on http://localhost:${options.port}`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));
    
    // Simple HTTP server
    const http = require('http');
    const url = require('url');

    const server = http.createServer((req: any, res: any) => {
      let filePath = path.join(options.path, req.url === '/' ? 'index.html' : req.url);
      
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(options.port);
  });

/**
 * HELP COMMAND
 */
program
  .command('help [command]')
  .description('Show help')
  .action((cmd) => {
    if (cmd) {
      program.emit('--help');
    }
  });

program.on('--help', () => {
  console.log('\n' + chalk.cyan('Examples:'));
  console.log('  $ flow-visualizer analyze');
  console.log('  $ flow-visualizer analyze -p ./src -o ./docs');
  console.log('  $ flow-visualizer export -o data.json');
  console.log('  $ flow-visualizer validate\n');
});

/**
 * Helper: Get MIME type
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath);
  const types: { [key: string]: string } = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };
  return types[ext] || 'text/plain';
}

// Parse CLI arguments
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}