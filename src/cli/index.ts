#!/usr/bin/env node

import { Command } from 'commander';
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { TypeScriptDiffAnalyzer } from '../diff/analyzer';
import { AnalysisResult, Change } from '../types';
import { ConfigLoader } from '../config/config-loader';

const program = new Command();

program
  .name('typeshift')
  .description('Analyze changes between TypeScript definition files')
  .version('1.0.0')
  .requiredOption('--old <file>', 'Path to the old .d.ts file')
  .requiredOption('--new <file>', 'Path to the new .d.ts file')
  .option('--format <type>', 'Output format (json, text, html)', 'text')
  .option('--output <file>', 'Output file path')
  .option('--verbose', 'Show detailed information about changes')
  .option('--config <file>', 'Path to config file')
  .option('--ignore-private', 'Ignore private members', true)
  .option('--ignore-internal', 'Ignore internal members', false)
  .option(
    '--treat-missing-as-undefined',
    'Treat missing types as undefined',
    false
  )
  .option('--treat-undefined-as-any', 'Treat undefined as any', false)
  .parse(process.argv);

const options = program.opts();

function validateFile(filePath: string): string {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(chalk.red(`Error: File not found: ${filePath}`));
    process.exit(1);
  }
  return resolvedPath;
}

function formatChange(change: Change): string {
  const severity = {
    major: chalk.red('MAJOR'),
    minor: chalk.yellow('MINOR'),
    patch: chalk.green('PATCH'),
    none: chalk.gray('NONE'),
  }[change.severity];

  let location = '';
  if (change.location?.oldFile) {
    location += ` (old: ${change.location.oldFile.line}:${change.location.oldFile.column})`;
  }
  if (change.location?.newFile) {
    location += ` (new: ${change.location.newFile.line}:${change.location.newFile.column})`;
  }

  return `${severity} ${change.type}: ${change.description}${location}`;
}

function formatTextOutput(result: AnalysisResult): string {
  const { recommendedVersionBump, changes, summary } = result;

  const lines = [
    chalk.bold('\nTypeScript Definition Changes Analysis'),
    chalk.bold('\nRecommended Version Bump:'),
    {
      major: chalk.red('MAJOR'),
      minor: chalk.yellow('MINOR'),
      patch: chalk.green('PATCH'),
      none: chalk.gray('NONE'),
    }[recommendedVersionBump],
    '',
    chalk.bold('Changes:'),
    ...changes.map((change) => formatChange(change)),
    '',
    chalk.bold('Summary:'),
    `Major Changes: ${chalk.red(summary.majorChanges)}`,
    `Minor Changes: ${chalk.yellow(summary.minorChanges)}`,
    `Patch Changes: ${chalk.green(summary.patchChanges)}`,
  ];

  return lines.join('\n');
}

function formatHtmlOutput(result: AnalysisResult): string {
  const severityColors = {
    major: '#ff0000',
    minor: '#ffa500',
    patch: '#008000',
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>TypeScript Definition Changes Analysis</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .change { margin: 10px 0; }
    .major { color: ${severityColors.major}; }
    .minor { color: ${severityColors.minor}; }
    .patch { color: ${severityColors.patch}; }
  </style>
</head>
<body>
  <h1>TypeScript Definition Changes Analysis</h1>

  <h2>Recommended Version Bump</h2>
  <p class="${
    result.recommendedVersionBump
  }">${result.recommendedVersionBump.toUpperCase()}</p>

  <h2>Changes</h2>
  ${result.changes
    .map(
      (change) => `
    <div class="change ${change.severity}">
      <strong>${change.severity.toUpperCase()}</strong> ${change.type}: ${
        change.description
      }
      ${
        change.location
          ? `<br>
        <small>
          ${
            change.location.oldFile
              ? `Old: ${change.location.oldFile.line}:${change.location.oldFile.column}`
              : ''
          }
          ${
            change.location.newFile
              ? `New: ${change.location.newFile.line}:${change.location.newFile.column}`
              : ''
          }
        </small>
      `
          : ''
      }
    </div>
  `
    )
    .join('')}

  <h2>Summary</h2>
  <p>
    <span class="major">Major Changes: ${result.summary.majorChanges}</span><br>
    <span class="minor">Minor Changes: ${result.summary.minorChanges}</span><br>
    <span class="patch">Patch Changes: ${result.summary.patchChanges}</span>
  </p>
</body>
</html>`;

  return html;
}

async function main() {
  try {
    const oldFile = validateFile(options.old);
    const newFile = validateFile(options.new);

    // Load configuration
    const configLoader = ConfigLoader.getInstance();
    const config = await configLoader.loadConfig(options.config);

    // Merge CLI options with config
    const analyzerOptions = {
      ...config,
      ignorePrivateMembers:
        options.ignorePrivate ?? config.ignorePrivateMembers,
      ignoreInternalMembers:
        options.ignoreInternal ?? config.ignoreInternalMembers,
      treatMissingAsUndefined:
        options.treatMissingAsUndefined ?? config.treatMissingAsUndefined,
      treatUndefinedAsAny:
        options.treatUndefinedAsAny ?? config.treatUndefinedAsAny,
    };

    const analyzer = new TypeScriptDiffAnalyzer(
      oldFile,
      newFile,
      analyzerOptions
    );
    const result = analyzer.analyze();

    let output: string;
    switch (options.format) {
      case 'json':
        output = JSON.stringify(result, null, 2);
        break;
      case 'html':
        output = formatHtmlOutput(result);
        break;
      default:
        output = formatTextOutput(result);
    }

    if (options.output) {
      fs.writeFileSync(options.output, output);
      console.log(chalk.green(`Analysis result written to ${options.output}`));
    } else {
      console.log(output);
    }

    // Exit with non-zero code if major changes are detected
    process.exit(result.summary.majorChanges > 0 ? 1 : 0);
  } catch (error) {
    console.error(chalk.red('Error:', (error as Error).message));
    process.exit(1);
  }
}

main();
