#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

// Available examples
const examples = {
  'react-components': 'React Component Types',
  'web-patterns': 'Web API Patterns',
  'dom-apis': 'DOM API Types',
  'state-management': 'State Management Types',
  'html-output': 'HTML Output Format Example',
};

function printHeader(text) {
  console.log('\n' + colors.bright + colors.blue + '='.repeat(50));
  console.log(text);
  console.log('='.repeat(50) + colors.reset + '\n');
}

function runExample(exampleName) {
  const v1Path = path.join(__dirname, exampleName, 'v1/index.d.ts');
  const v2Path = path.join(__dirname, exampleName, 'v2/index.d.ts');
  const cliPath = path.join(__dirname, '../dist/cli/index.js');

  if (!fs.existsSync(v1Path) || !fs.existsSync(v2Path)) {
    console.log(colors.yellow + `Skipping ${exampleName} - missing files` + colors.reset);
    return;
  }

  if (!fs.existsSync(cliPath)) {
    console.error(colors.red + 'Error: CLI not built. Please run npm run build first.' + colors.reset);
    process.exit(1);
  }

  printHeader(`Running ${examples[exampleName]} Example`);

  try {
    const cmd = `node "${cliPath}" --old "${v1Path}" --new "${v2Path}"`;
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(output);
  } catch (error) {
    if (error.stdout) {
      // If there's output, show it (typeshift shows analysis even with exit code 1)
      console.log(error.stdout);
    } else {
      console.error(colors.red + 'Error running example:' + colors.reset);
      console.error(error.message);
    }
  }
}

// Run all examples if no argument provided
const targetExample = process.argv[2];
if (targetExample) {
  if (examples[targetExample]) {
    runExample(targetExample);
  } else {
    console.error(colors.red + 'Unknown example: ' + targetExample + colors.reset);
    console.log('\nAvailable examples:');
    Object.keys(examples).forEach(name => {
      console.log(`- ${name}: ${examples[name]}`);
    });
  }
} else {
  printHeader('Running All Examples');
  Object.keys(examples).forEach(runExample);
} 