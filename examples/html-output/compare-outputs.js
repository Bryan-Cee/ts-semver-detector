#!/usr/bin/env node

/**
 * This script compares the different output formats (text, JSON, HTML)
 * available in ts-semver-detector to show how the type display differs.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
};

// Path configuration
const v1Path = path.join(__dirname, 'v1/index.d.ts');
const v2Path = path.join(__dirname, 'v2/index.d.ts');
const cliPath = path.join(__dirname, '../../dist/cli/index.js');
const outputDir = __dirname;

// Ensure the CLI is built
if (!fs.existsSync(cliPath)) {
  console.error('Error: CLI not built. Please run npm run build first.');
  process.exit(1);
}

console.log(`${colors.bright}${colors.blue}=`.repeat(50));
console.log('Comparing Different Output Formats');
console.log('='.repeat(50) + colors.reset + '\n');

/**
 * Run the CLI with different output formats and save the results
 */
function runWithFormat(format, outputPath = null) {
  const outputFlag = outputPath ? `--output "${outputPath}"` : '';
  const cmd = `node "${cliPath}" --old "${v1Path}" --new "${v2Path}" --format ${format} ${outputFlag} --show-types`;
  
  console.log(`${colors.bright}${colors.yellow}Running with format: ${format}${colors.reset}`);
  console.log(`Executing: ${cmd}\n`);
  
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    if (!outputPath) {
      // For text output to console, limit the length to avoid flooding
      const maxOutputLength = 500;
      if (output.length > maxOutputLength) {
        console.log(output.substring(0, maxOutputLength) + '...\n[Output truncated]');
      } else {
        console.log(output);
      }
    } else {
      console.log(`${colors.bright}${colors.green}Output saved to: ${outputPath}${colors.reset}\n`);
    }
    
    return true;
  } catch (error) {
    if (error.stdout) {
      console.log(error.stdout);
      return true;
    } else {
      console.error('Error:');
      console.error(error.message);
      return false;
    }
  }
}

// Run with each format
const textSuccess = runWithFormat('text');
console.log(`${colors.bright}${colors.blue}${'='.repeat(50)}${colors.reset}\n`);

const jsonPath = path.join(outputDir, 'output.json');
const jsonSuccess = runWithFormat('json', jsonPath);
console.log(`${colors.bright}${colors.blue}${'='.repeat(50)}${colors.reset}\n`);

const htmlPath = path.join(outputDir, 'output.html');
const htmlSuccess = runWithFormat('html', htmlPath);

// Summary
console.log(`${colors.bright}${colors.blue}${'='.repeat(50)}`);
console.log('Summary of Output Formats');
console.log('='.repeat(50) + colors.reset + '\n');

console.log('This example demonstrates the differences between output formats:');
console.log('1. Text format: Simple, concise output for command line use');
console.log('2. JSON format: Structured data for programmatic processing');
console.log('3. HTML format: Rich visual diffs for detailed review\n');

console.log(`${colors.bright}${colors.yellow}New HTML Diff Improvements:${colors.reset}`);
console.log('• More precise highlighting of changes - only the specific additions/removals are highlighted');
console.log('• Selective property highlighting - property names and values are distinctly highlighted');
console.log('• Word-level diffing - shows exactly what changed within types');
console.log('• Special handling for union types - better visualization of changes to type unions\n');

console.log('Generated files:');
if (jsonSuccess) console.log(`- JSON output: ${jsonPath}`);
if (htmlSuccess) console.log(`- HTML output: ${htmlPath}`);

console.log('\nTo view the HTML report in your browser:');
console.log(`open "${htmlPath}"`);

console.log('\nTo parse the JSON data in a script:');
console.log(`node -e "console.log(JSON.parse(require('fs').readFileSync('${jsonPath}', 'utf8')).recommendedVersionBump)"`); 