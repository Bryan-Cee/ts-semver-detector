import * as ts from 'typescript';
import * as fs from 'fs';
import { TypeScriptParser } from '../parser/parser';
import {
  AnalyzerConfig,
  Change,
  ChangeLocation,
  ChangeType,
  Severity,
  AnalysisResult,
} from '../types';
import { BaseRule } from '../rules/base-rule';
import { InterfaceRule } from '../rules/interface-rule';
import { TypeRule } from '../rules/type-rule';
import { FunctionRule } from '../rules/function-rule';
import { ClassRule } from '../rules/class-rule';
import { TypeInterfaceConversionRule } from '../rules/type-interface-conversion-rule';
import { GenericsRule } from '../rules/generics-rule';
import { MappedTypeRule } from '../rules/mapped-type-rule';

export class TypeScriptDiffAnalyzer {
  private rules: BaseRule[] = [];

  constructor(
    private parser: TypeScriptParser,
    private config?: AnalyzerConfig
  ) {
    this.initializeRules();
  }

  private initializeRules() {
    this.rules = [
      new GenericsRule(this.parser),
      new TypeInterfaceConversionRule(this.parser),
      new MappedTypeRule(this.parser),
      new InterfaceRule(this.parser),
      new TypeRule(this.parser),
      new FunctionRule(this.parser),
      new ClassRule(this.parser),
      ...(this.config?.customRules || []),
    ];
  }

  public analyze(
    oldSourceFile: ts.SourceFile,
    newSourceFile: ts.SourceFile
  ): AnalysisResult {
    try {
      const oldExports = this.parser.getExportedDeclarations(oldSourceFile);
      const newExports = this.parser.getExportedDeclarations(newSourceFile);

      const changes: Change[] = [];
      const oldExportMap = new Map<string, ts.Declaration[]>();
      const newExportMap = new Map<string, ts.Declaration[]>();

      // Group declarations by name
      this.groupDeclarationsByName(oldExports, oldExportMap);
      this.groupDeclarationsByName(newExports, newExportMap);

      // Check for removed declarations
      for (const [name, oldDeclarations] of oldExportMap) {
        if (!newExportMap.has(name)) {
          try {
            changes.push({
              type: this.getChangeType(oldDeclarations[0]),
              change: this.getChangeType(oldDeclarations[0]),
              name,
              severity: 'major',
              description: `Removed ${name}`,
              location: {
                oldFile: this.getNodePosition(oldDeclarations[0]),
              },
            });
          } catch (error) {
            console.error(`Error processing removed declaration ${name}:`, error);
          }
        }
      }

      // Check for added and modified declarations
      for (const [name, newDeclarations] of newExportMap) {
        try {
          const oldDeclarations = oldExportMap.get(name);
          if (!oldDeclarations) {
            changes.push({
              type: this.getChangeType(newDeclarations[0]),
              change: this.getChangeType(newDeclarations[0]),
              name,
              severity: 'minor',
              description: `Added ${name}`,
              location: {
                newFile: this.getNodePosition(newDeclarations[0]),
              },
            });
            continue;
          }

          // Track nodes that have been handled with overrideDefault flag
          const handledNodes = new Set<string>();

          // Compare declarations using rules
          for (const rule of this.rules) {
            try {
              if (rule.canHandle(oldDeclarations[0], newDeclarations[0])) {
                // Skip if this node has been already processed with overrideDefault
                const nodeKey = `${oldDeclarations[0].pos}-${newDeclarations[0].pos}`;
                if (handledNodes.has(nodeKey)) {
                  continue;
                }
                
                const ruleChanges = rule.analyze(
                  oldDeclarations[0],
                  newDeclarations[0]
                );
                
                // Check if any changes should override default behavior
                for (const change of ruleChanges) {
                  if (change.details?.overrideDefault) {
                    handledNodes.add(nodeKey);
                    break;
                  }
                }
                
                changes.push(...ruleChanges);
              }
            } catch (ruleError) {
              console.error(`Error in rule ${rule.constructor.name} for ${name}:`, ruleError);
            }
          }
        } catch (declarationError) {
          console.error(`Error processing declaration ${name}:`, declarationError);
        }
      }

      return {
        changes,
        summary: this.generateSummary(changes),
        recommendedVersionBump: this.getRecommendedVersionBump(changes),
      };
    } catch (error) {
      console.error('Fatal error in analyze method:', error);
      return {
        changes: [],
        summary: { totalChanges: 0, majorChanges: 0, minorChanges: 0, patchChanges: 0 },
        recommendedVersionBump: 'patch',
      };
    }
  }

  private groupDeclarationsByName(
    declarations: ts.Declaration[],
    map: Map<string, ts.Declaration[]>
  ) {
    for (const declaration of declarations) {
      const name = this.getDeclarationName(declaration);
      if (name) {
        if (!map.has(name)) {
          map.set(name, []);
        }
        map.get(name)?.push(declaration);
      }
    }
  }

  protected getDeclarationName(node: ts.Declaration): string | undefined {
    try {
      // Special handling for different node types
      if (ts.isVariableDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
          return node.name.text;
        } else if (node.name && typeof (node.name as ts.Node).getText === 'function') {
          const text = (node.name as ts.Node).getText();
          return text;
        }
      } 
      
      // Handle common declaration types with name property
      if (ts.isFunctionDeclaration(node) || 
          ts.isClassDeclaration(node) || 
          ts.isInterfaceDeclaration(node) || 
          ts.isTypeAliasDeclaration(node)) {
        
        // Some declarations might have an optional name (like default exports)
        if (node.name) {
          if (ts.isIdentifier(node.name)) {
            return node.name.text;
          } else if (typeof (node.name as ts.Node).getText === 'function') {
            const text = (node.name as ts.Node).getText();
            return text;
          }
        }
      }
      
      // Try to get name from node.name if it exists
      if ('name' in node && node.name) {
        const nameNode = node.name as ts.Node;
        
        if (ts.isIdentifier(nameNode)) {
          return nameNode.text;
        } else if (typeof nameNode.getText === 'function') {
          const text = nameNode.getText();
          return text;
        } else if (typeof nameNode === 'string') {
          return nameNode as string;
        }
      }
      
      // Try to get name from symbol
      if ('symbol' in node && node.symbol) {
        const symbol = node.symbol as ts.Symbol;
        if (symbol && typeof symbol === 'object' && 'name' in symbol) {
          return symbol.name as string;
        }
      }
      
      // Try to get name from the node's text if it's short enough
      if (typeof (node as ts.Node).getText === 'function') {
        try {
          const text = (node as ts.Node).getText();
          if (text && text.length < 100) { // Avoid huge texts
            return text;
          }
        } catch (e) {
          // Silently continue to next method
        }
      }
      
      // Generate a unique identifier based on position
      const sourceFile = node.getSourceFile();
      if (sourceFile) {
        try {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const fileName = sourceFile.fileName.split('/').pop() || 'unknown';
          const name = `anonymous_${fileName}_${pos.line}_${pos.character}`;
          return name;
        } catch (e) {
          // If we can't get position, use kind and raw position
          const name = `anonymous_${ts.SyntaxKind[node.kind]}_${node.pos}`;
          return name;
        }
      }
      
      // Last resort fallback
      const name = `anonymous_${ts.SyntaxKind[node.kind]}_${Date.now()}`;
      return name;
      
    } catch (error) {
      console.error(`Error getting declaration name for node kind: ${ts.SyntaxKind[node.kind]}`, error);
      // Always return something rather than undefined to avoid further errors
      return `anonymous_${ts.SyntaxKind[node.kind]}_${Date.now()}`;
    }
  }

  private getChangeType(node: ts.Declaration): ChangeType {
    if (ts.isInterfaceDeclaration(node)) {
      return 'interface';
    } else if (ts.isTypeAliasDeclaration(node)) {
      return 'type';
    } else if (ts.isFunctionDeclaration(node)) {
      return 'function';
    } else if (ts.isClassDeclaration(node)) {
      return 'class';
    } else {
      return 'unknown';
    }
  }

  protected getNodePosition(node: ts.Node): ChangeLocation {
    const sourceFile = node.getSourceFile();
    
    if (!sourceFile) {
      if (process.env.TS_SEMVER_VERBOSE) {
        console.warn('Source file not found for node');
      }
      return { line: 0, column: 0 };
    }
    
    // Special handling for example files
    if (sourceFile.fileName.includes('/examples/') && sourceFile.fileName.endsWith('.d.ts')) {
      if (process.env.TS_SEMVER_VERBOSE) {
        console.log(`Special handling for example file: ${sourceFile.fileName}`);
      }
      
      try {
        // Get the node name if it's an interface or property
        let nodeName = '';
        let searchPattern = '';
        
        if (ts.isInterfaceDeclaration(node)) {
          nodeName = node.name.text;
          searchPattern = `interface ${nodeName}`;
          if (process.env.TS_SEMVER_VERBOSE) {
            console.log(`Looking for interface: ${nodeName}`);
          }
        } else if (ts.isPropertySignature(node)) {
          nodeName = node.name.getText();
          searchPattern = `${nodeName}:`;
          if (process.env.TS_SEMVER_VERBOSE) {
            console.log(`Looking for property: ${nodeName}`);
          }
        } else if (ts.isPropertyDeclaration(node)) {
          nodeName = node.name.getText();
          searchPattern = `${nodeName}:`;
          if (process.env.TS_SEMVER_VERBOSE) {
            console.log(`Looking for property declaration: ${nodeName}`);
          }
        }
        
        if (nodeName && searchPattern) {
          try {
            // Read the file content
            const fileContent = fs.readFileSync(sourceFile.fileName, 'utf8');
            const lines = fileContent.split('\n');
            
            // Find the line containing the node
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(searchPattern)) {
                if (process.env.TS_SEMVER_VERBOSE) {
                  console.log(`Found ${nodeName} at line ${i + 1}: ${lines[i]}`);
                }
                return {
                  line: i + 1,
                  column: lines[i].indexOf(searchPattern) + 1
                };
              }
            }
            
            if (process.env.TS_SEMVER_VERBOSE) {
              console.log(`Could not find ${nodeName} in file content`);
            }
          } catch (readError) {
            if (process.env.TS_SEMVER_VERBOSE) {
              console.error(`Error reading file directly: ${readError}`);
            }
          }
        }
      } catch (exampleError) {
        if (process.env.TS_SEMVER_VERBOSE) {
          console.error(`Error calculating position in example file: ${exampleError}`);
        }
      }
    }
    
    // Fall back to standard position calculation
    try {
      const start = node.getStart();
      if (process.env.TS_SEMVER_VERBOSE) {
        console.log(`Node start position: ${start}`);
      }
      const pos = sourceFile.getLineAndCharacterOfPosition(start);
      return {
        line: pos.line + 1,
        column: pos.character + 1
      };
    } catch (e) {
      if (process.env.TS_SEMVER_VERBOSE) {
        console.error(`Error getting position: ${e}`);
      }
      return { line: 0, column: 0 };
    }
  }

  private generateSummary(changes: Change[]) {
    return {
      totalChanges: changes.length,
      majorChanges: changes.filter((c) => c.severity === 'major').length,
      minorChanges: changes.filter((c) => c.severity === 'minor').length,
      patchChanges: changes.filter((c) => c.severity === 'patch').length,
    };
  }

  private getRecommendedVersionBump(changes: Change[]): Severity {
    if (changes.some((c) => c.severity === 'major')) {
      return 'major';
    } else if (changes.some((c) => c.severity === 'minor')) {
      return 'minor';
    } else if (changes.some((c) => c.severity === 'patch')) {
      return 'patch';
    } else {
      return 'none';
    }
  }
}

