#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
// Only needed for HTML output formatting
import * as diff from 'diff';
import { TypeScriptDiffAnalyzer } from '../diff/analyzer';
import { TypeScriptParser } from '../parser/parser';
import { AnalysisResult, Change, Severity, ChangeType, ChangeLocation } from '../types';
import { ConfigLoader } from '../config/config-loader';

const program = new Command();

program
  .name('ts-semver-detector')
  .description('Analyze changes between TypeScript definition files')
  .version('1.0.0')
  .requiredOption('--old <file>', 'Path to the old .d.ts file')
  .requiredOption('--new <file>', 'Path to the new .d.ts file')
  .option('--format <type>', 'Output format (json, text, html)', 'text')
  .option('--output <file>', 'Output file path')
  .option('--verbose', 'Show detailed information about changes')
  .option('--show-types', 'Display the actual type differences in the output')
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

// Enable verbose logging if requested
if (options.verbose) {
  // Set a global flag that can be checked by other modules
  process.env.TS_SEMVER_VERBOSE = 'true';
  console.log(chalk.yellow('Verbose logging enabled'));
}

function validateFile(filePath: string): string {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(chalk.red(`Error: File not found: ${filePath}`));
    process.exit(1);
  }
  return resolvedPath;
}

function formatChange(change: Change): string {
  let location = '';
  
  if (change.location) {
    if (change.location.oldFile) {
      location += `Old: ${change.location.oldFile.line}:${change.location.oldFile.column}`;
    }
    if (change.location.newFile) {
      location += ` New: ${change.location.newFile.line}:${change.location.newFile.column}`;
    }
    
    // If we're dealing with example files, try to find the line numbers
    if (location === 'Old: 0:0 New: 0:0' && change.name) {
      // Extract the property name from the change name
      const parts = change.name.split('.');
      if (parts.length > 1) {
        const propertyName = parts[parts.length - 1];
        const interfaceName = parts[parts.length - 2];
        
        if (process.env.TS_SEMVER_VERBOSE) {
          console.log(`Trying to find line number for ${interfaceName}.${propertyName}`);
        }
        
        // Try to find the line number in the example files
        const oldFile = options.old;
        const newFile = options.new;
        
        if (oldFile && newFile && 
            (oldFile.includes('/examples/') || newFile.includes('/examples/')) &&
            (oldFile.endsWith('.d.ts') || newFile.endsWith('.d.ts'))) {
          
          try {
            // Read the files
            const oldContent = fs.readFileSync(oldFile, 'utf8');
            const newContent = fs.readFileSync(newFile, 'utf8');
            
            // Find the line numbers
            const oldLines = oldContent.split('\n');
            const newLines = newContent.split('\n');
            
            let oldLine = 0;
            let oldColumn = 0;
            let newLine = 0;
            let newColumn = 0;
            
            // Look for the property in the old file
            if (change.type === 'interface' && change.change === 'memberAdded') {
              // For added members, look for the interface in the old file
              const searchPattern = `interface ${interfaceName}`;
              for (let i = 0; i < oldLines.length; i++) {
                if (oldLines[i].includes(searchPattern)) {
                  oldLine = i + 1;
                  oldColumn = oldLines[i].indexOf(searchPattern) + 1;
                  break;
                }
              }
            } else {
              // For other changes, look for the property in the old file
              const searchPattern = `${propertyName}:`;
              for (let i = 0; i < oldLines.length; i++) {
                if (oldLines[i].includes(searchPattern)) {
                  oldLine = i + 1;
                  oldColumn = oldLines[i].indexOf(searchPattern) + 1;
                  break;
                }
              }
            }
            
            // Look for the property in the new file
            if (change.type === 'interface' && change.change === 'memberRemoved') {
              // For removed members, look for the interface in the new file
              const searchPattern = `interface ${interfaceName}`;
              for (let i = 0; i < newLines.length; i++) {
                if (newLines[i].includes(searchPattern)) {
                  newLine = i + 1;
                  newColumn = newLines[i].indexOf(searchPattern) + 1;
                  break;
                }
              }
            } else if (change.type === 'interface' && change.change === 'memberAdded') {
              // For added members, look for the property in the new file
              // Try different search patterns
              let searchPatterns = [
                `${propertyName}:`,
                `${propertyName}?:`,
                `${propertyName} :`,
                `${propertyName}? :`
              ];
              
              // Only log if verbose is enabled
              if (process.env.TS_SEMVER_DEBUG) {
                console.log(`Searching for property "${propertyName}" in new file with patterns: ${searchPatterns.join(', ')}`);
                // Print the first 20 lines of the new file for debugging
                for (let i = 0; i < Math.min(newLines.length, 20); i++) {
                  console.log(`Line ${i + 1}: ${newLines[i]}`);
                }
              }
              
              for (let i = 0; i < newLines.length; i++) {
                for (const pattern of searchPatterns) {
                  if (newLines[i].includes(pattern)) {
                    newLine = i + 1;
                    newColumn = newLines[i].indexOf(pattern) + 1;
                    if (process.env.TS_SEMVER_DEBUG) {
                      console.log(`Found "${pattern}" at line ${newLine}:${newColumn}: ${newLines[i]}`);
                    }
                    break;
                  }
                }
                if (newLine > 0) break;
              }
            } else {
              // For other changes, look for the property in the new file
              const searchPattern = `${propertyName}:`;
              for (let i = 0; i < newLines.length; i++) {
                if (newLines[i].includes(searchPattern)) {
                  newLine = i + 1;
                  newColumn = newLines[i].indexOf(searchPattern) + 1;
                  break;
                }
              }
            }
            
            // Update the location if we found something
            if (oldLine > 0 || newLine > 0) {
              location = `Old: ${oldLine}:${oldColumn} New: ${newLine}:${newColumn}`;
              if (process.env.TS_SEMVER_VERBOSE) {
                console.log(`Found line numbers for ${interfaceName}.${propertyName}: ${location}`);
              }
            }
          } catch (error) {
            console.error(`Error finding line numbers: ${error}`);
          }
        }
      }
    }
  }

  return [
    `${change.severity.toUpperCase()} ${change.type}: ${change.description}`,
    location ? chalk.dim(`  Location: ${location}`) : '',
  ].filter(Boolean).join('\n');
}

function formatTypeInfo(change: Change): string[] {
  const options = program.opts();
  const showTypes = options.showTypes || false;
  
  if (!showTypes || (!change.oldType && !change.newType)) {
    return [];
  }

  const lines: string[] = [];
  
  lines.push(chalk.dim('  Type Information:'));
  
  // For text output, just show a simple summary of what changed
  // No detailed diffs - those will only be in HTML output
  if (change.oldType && change.newType) {
    // Just show a simplified line mentioning the change
    lines.push(chalk.dim(`    Type definition changed. See location for details.`));
    
    // Extract property name from change description if available
    const propertyNameMatch = change.description?.match(/property ['"]?([\w.]+)['"]?/);
    const propertyName = propertyNameMatch ? propertyNameMatch[1] : null;
    
    if (propertyName) {
      lines.push(chalk.cyan(`    Property: ${propertyName}`));
    }
  } else {
    // Fall back to original behavior for one-sided changes
    if (change.oldType) {
      lines.push(chalk.red(`    - Old type declaration removed`));
    }
    
    if (change.newType) {
      lines.push(chalk.green(`    + New type declaration added`));
    }
  }
  
  return lines;
}

function formatTextOutput(result: AnalysisResult): string {
  const lines = [
    chalk.bold('TypeScript Definition Changes Analysis'),
    '',
    chalk.bold('Recommended Version Bump:'),
    `${
      result.recommendedVersionBump === 'major'
        ? chalk.red(result.recommendedVersionBump.toUpperCase())
        : result.recommendedVersionBump === 'minor'
        ? chalk.yellow(result.recommendedVersionBump.toUpperCase())
        : chalk.green(result.recommendedVersionBump.toUpperCase())
    }`,
    '',
    chalk.bold('Changes:'),
    ...result.changes.flatMap((change) => {
      return [
        formatChange(change),
        ...formatTypeInfo(change),
        ''
      ].filter(Boolean);
    }),
    '',
    chalk.bold('Summary:'),
    `Major Changes: ${chalk.red(result.summary.majorChanges)}`,
    `Minor Changes: ${chalk.yellow(result.summary.minorChanges)}`,
    `Patch Changes: ${chalk.green(result.summary.patchChanges)}`,
  ];

  return lines.join('\n');
}

function formatHtmlOutput(result: AnalysisResult): string {
  const severityColors = {
    major: '#ff0000',
    minor: '#ffa500',
    patch: '#008000',
  };

  const options = program.opts();
  const showTypes = options.showTypes || false;

  // Function to generate a highlighted diff for HTML display
  function createTypeDiff(oldType?: string, newType?: string, changeDescription?: string): string {
    if (!oldType && !newType) {
      return '';
    }

    if (!oldType) {
      return `<pre class="new-type">${escapeHtml(newType || '')}</pre>`;
    }

    if (!newType) {
      return `<pre class="old-type">${escapeHtml(oldType)}</pre>`;
    }

    // Extract property name from change description if available
    const propertyNameMatch = changeDescription?.match(/property ['"]?([\w.]+)['"]?/);
    const propertyName = propertyNameMatch ? propertyNameMatch[1] : null;
    
    // For property changes in objects, create a more refined diff
    if (propertyName) {
      // First do a line-by-line diff to identify the changed areas
      const lineByLineDiff = diff.diffLines(oldType, newType);
      
      // Create a more refined character-based diff for the parts that changed
      let diffHtml = '<pre class="type-diff-inline">';
      
      lineByLineDiff.forEach(part => {
        // If this part is marked as added or removed
        if (part.added || part.removed) {
          // Find the matching part in the other version for comparison
          let matchingPart;
          
          // For added parts, try to find a counterpart in the old type
          if (part.added) {
            // Try to find context before and after the added property
            const contextBefore = newType.substring(0, newType.indexOf(part.value)).split('\n').slice(-3).join('\n');
            const contextAfter = newType.substring(newType.indexOf(part.value) + part.value.length).split('\n').slice(0, 3).join('\n');
            
            // Look for similar context in the old type to find where this would have been
            const oldBeforeIndex = oldType.indexOf(contextBefore);
            const oldAfterIndex = oldType.indexOf(contextAfter);
            
            if (oldBeforeIndex !== -1 && oldAfterIndex !== -1) {
              matchingPart = oldType.substring(oldBeforeIndex + contextBefore.length, oldAfterIndex);
            }
          }
          
          // If it's a removed part, look for a counterpart in the new type
          if (part.removed) {
            // Similar logic as above but looking in the new type
            const contextBefore = oldType.substring(0, oldType.indexOf(part.value)).split('\n').slice(-3).join('\n');
            const contextAfter = oldType.substring(oldType.indexOf(part.value) + part.value.length).split('\n').slice(0, 3).join('\n');
            
            const newBeforeIndex = newType.indexOf(contextBefore);
            const newAfterIndex = newType.indexOf(contextAfter);
            
            if (newBeforeIndex !== -1 && newAfterIndex !== -1) {
              matchingPart = newType.substring(newBeforeIndex + contextBefore.length, newAfterIndex);
            }
          }
          
          // If we found a matching part, do a word-level diff
          if (matchingPart) {
            const wordDiff = diff.diffWords(
              part.removed ? part.value : matchingPart,
              part.added ? part.value : matchingPart
            );
            
            // Add each change with more precise highlighting
            wordDiff.forEach(wordPart => {
              if (wordPart.added) {
                diffHtml += `<span class="added">${escapeHtml(wordPart.value)}</span>`;
              } else if (wordPart.removed) {
                diffHtml += `<span class="removed">${escapeHtml(wordPart.value)}</span>`;
              } else {
                diffHtml += `<span class="unchanged">${escapeHtml(wordPart.value)}</span>`;
              }
            });
          } else {
            // If no matching part was found, default to the original behavior
            diffHtml += `<span class="${part.added ? 'added' : 'removed'}">${escapeHtml(part.value)}</span>`;
          }
        } else {
          // For unchanged parts containing the property name, highlight just the property
          if (propertyName && part.value.includes(propertyName)) {
            const lines = part.value.split('\n');
            const highlightedLines = lines.map(line => {
              if (line.includes(propertyName)) {
                // Only highlight the property name/value, not the entire line
                const propertyIndex = line.indexOf(propertyName);
                const beforeProperty = line.substring(0, propertyIndex);
                const afterProperty = line.substring(propertyIndex + propertyName.length);
                
                // Find where the property value starts (after the colon and whitespace)
                const colonIndex = afterProperty.indexOf(':');
                if (colonIndex !== -1) {
                  const valueStart = colonIndex + 1;
                  // Skip whitespace after the colon
                  let valueEnd = valueStart;
                  while (valueEnd < afterProperty.length && 
                         (afterProperty[valueEnd] === ' ' || afterProperty[valueEnd] === '\t')) {
                    valueEnd++;
                  }
                  
                  // Find where the value ends (at semicolon, comma or line end)
                  let endChar = afterProperty.indexOf(';', valueEnd);
                  if (endChar === -1) endChar = afterProperty.indexOf(',', valueEnd);
                  if (endChar === -1) endChar = afterProperty.length;
                  
                  const beforeValue = afterProperty.substring(0, valueEnd);
                  const propertyValue = afterProperty.substring(valueEnd, endChar);
                  const afterValue = afterProperty.substring(endChar);
                  
                  return escapeHtml(beforeProperty) + 
                         `<span class="property-highlight">${escapeHtml(propertyName)}</span>` + 
                         escapeHtml(beforeValue) +
                         `<span class="property-value-highlight">${escapeHtml(propertyValue)}</span>` +
                         escapeHtml(afterValue);
                }
                
                // If we couldn't parse the line precisely, highlight just the property name
                return escapeHtml(beforeProperty) + 
                       `<span class="property-highlight">${escapeHtml(propertyName)}</span>` + 
                       escapeHtml(afterProperty);
              }
              return escapeHtml(line);
            });
            diffHtml += `<span class="unchanged">${highlightedLines.join('\n')}</span>`;
          } else {
            // Regular unchanged parts
            diffHtml += `<span class="unchanged">${escapeHtml(part.value)}</span>`;
          }
        }
      });
      
      diffHtml += '</pre>';
      return diffHtml;
    } else {
      // For non-property changes (like entire type/interface declarations),
      // use a more detailed word-level diff
      const wordDiff = diff.diffWords(oldType, newType, {
        ignoreWhitespace: false, // We need to preserve formatting in TypeScript
      });
      let diffHtml = '<pre class="type-diff-inline">';

      // Handle special cases like union types better
      const isTypeAlias = oldType.includes('type ') && newType.includes('type ');
      const isUnionType = oldType.includes(' | ') || newType.includes(' | ');
      
      if (isTypeAlias && isUnionType) {
        // For union types, do a more precise token-based diff
        // This handles cases like adding a new union member better
        const oldTokens = oldType.split(/([|{}()<>:;,[\]\s"']+)/g).filter(Boolean);
        const newTokens = newType.split(/([|{}()<>:;,[\]\s"']+)/g).filter(Boolean);
        
        const tokenDiff = diff.diffArrays(oldTokens, newTokens);
        
        tokenDiff.forEach(part => {
          const color = part.added ? 'added' : part.removed ? 'removed' : 'unchanged';
          const value = part.value.join('');
          diffHtml += `<span class="${color}">${escapeHtml(value)}</span>`;
        });
      } else {
        // Use regular word diffing for other cases
        wordDiff.forEach(part => {
          const color = part.added ? 'added' : part.removed ? 'removed' : 'unchanged';
          diffHtml += `<span class="${color}">${escapeHtml(part.value)}</span>`;
        });
      }

      diffHtml += '</pre>';
      return diffHtml;
    }
  }

  // Escape HTML special characters
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>TypeScript Definition Changes Analysis</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .change { margin: 20px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
    .major { border-left: 5px solid ${severityColors.major}; }
    .minor { border-left: 5px solid ${severityColors.minor}; }
    .patch { border-left: 5px solid ${severityColors.patch}; }
    .severity { font-weight: bold; }
    .major .severity { color: ${severityColors.major}; }
    .minor .severity { color: ${severityColors.minor}; }
    .patch .severity { color: ${severityColors.patch}; }
    pre { margin: 0; padding: 10px; background-color: #f5f5f5; overflow: auto; white-space: pre-wrap; word-wrap: break-word; }
    .type-diff-inline { font-family: monospace; line-height: 1.5; max-height: 400px; overflow-y: auto; }
    .added { background-color: #e6ffed; color: #22863a; }
    .removed { background-color: #ffeef0; color: #cb2431; }
    .unchanged { color: #24292e; }
    .property-highlight { background-color: #fffbdd; border-radius: 2px; padding: 1px; }
    .property-value-highlight { background-color: #e6ffed; border-radius: 2px; padding: 1px; color: #22863a; }
    .location { font-size: 0.8em; color: #666; margin-top: 5px; }
    .old-type { background-color: #ffeeee; }
    .new-type { background-color: #eeffee; }
    .type-block { margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; }
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
      <div>
        <span class="severity">${change.severity.toUpperCase()}</span> 
        <strong>${change.type}:</strong> ${change.description}
      </div>
      ${
        showTypes && (change.oldType || change.newType)
          ? `<div class="type-block">
              ${createTypeDiff(change.oldType, change.newType, change.description)}
            </div>`
          : ''
      }
      ${
        change.location
          ? `<div class="location">
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
            </div>`
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

function formatOutput(result: AnalysisResult, options: { format: string; showTypes?: boolean; }): string {
  let output = '';

  // Define jsonResult outside switch to avoid lexical declaration in case block
  let jsonResult: {
    recommendedVersionBump: Severity;
    changes: Array<{
      type: ChangeType;
      change: string;
      name: string;
      severity: Severity;
      description: string;
      location?: {
        oldFile?: ChangeLocation;
        newFile?: ChangeLocation;
      };
      details?: Record<string, unknown>;
      typeInfo?: {
        hasOldType: boolean;
        hasNewType: boolean;
        oldTypeSummary?: string;
        newTypeSummary?: string;
      };
    }>;
    summary: {
      totalChanges: number;
      majorChanges: number;
      minorChanges: number;
      patchChanges: number;
    };
  };

  switch (options.format) {
    case 'json':
      // For JSON output, always include concise type information
      // This keeps the JSON output clean while still providing necessary information
      jsonResult = {
        ...result,
        changes: result.changes.map(change => {
          // Include basic type info but not the full declarations
          const { oldType, newType, ...rest } = change;
          
          // Only include summary type information if --show-types is enabled
          if (options.showTypes) {
            return {
              ...rest,
              typeInfo: {
                hasOldType: !!oldType,
                hasNewType: !!newType,
                // Extract just the first line to give a hint about the type
                oldTypeSummary: oldType ? oldType.split('\n')[0] + (oldType.includes('\n') ? '...' : '') : undefined,
                newTypeSummary: newType ? newType.split('\n')[0] + (newType.includes('\n') ? '...' : '') : undefined,
              }
            };
          }
          
          return rest;
        })
      };
      
      output = JSON.stringify(jsonResult, null, 2);
      break;
    case 'html':
      output = formatHtmlOutput(result);
      break;
    default:
      output = formatTextOutput(result);
  }

  return output;
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

    // Create parser to get source files
    const parser = new TypeScriptParser([oldFile, newFile], analyzerOptions);
    const oldSourceFile = parser.getSourceFile(oldFile);
    const newSourceFile = parser.getSourceFile(newFile);
    
    if (!oldSourceFile || !newSourceFile) {
      throw new Error('Could not find source files');
    }
    
    // Create analyzer with parser
    const analyzer = new TypeScriptDiffAnalyzer(
      parser,
      analyzerOptions
    );
    
    // Call analyze with source files
    const result = analyzer.analyze(oldSourceFile, newSourceFile);

    const output = formatOutput(result, {
      format: options.format as string || 'text',
      showTypes: options.showTypes
    });

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
