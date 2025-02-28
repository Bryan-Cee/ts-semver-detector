#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
};

// Path configuration
const v1Path = path.join(__dirname, 'v1/index.d.ts');
const v2Path = path.join(__dirname, 'v2/index.d.ts');
const cliPath = path.join(__dirname, '../../dist/cli/index.js');
const outputPath = path.join(__dirname, 'output.html');

// Ensure the CLI is built
if (!fs.existsSync(cliPath)) {
  console.error('Error: CLI not built. Please run npm run build first.');
  process.exit(1);
}

console.log(`${colors.bright}${colors.blue}=`.repeat(50));
console.log('Running HTML Output Format Example with Type Information');
console.log('='.repeat(50) + colors.reset + '\n');

try {
  // Run the CLI with HTML format and save to file
  // Added --show-types option to display type differences
  const cmd = `node "${cliPath}" --old "${v1Path}" --new "${v2Path}" --format html --output "${outputPath}" --show-types`;
  
  console.log(`Executing: ${cmd}\n`);
  
  const output = execSync(cmd, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  console.log(output);
  
  console.log(`${colors.bright}${colors.green}HTML output saved to: ${outputPath}${colors.reset}`);
  console.log(`\nTo view the HTML report, open the file in your browser:`);
  console.log(`open "${outputPath}"\n`);
  
} catch (error) {
  if (error.stdout) {
    // If there's output, show it (ts-semver-detector shows analysis even with exit code 1)
    console.log(error.stdout);
  } else {
    console.error('Error running example:');
    console.error(error.message);
  }
} 