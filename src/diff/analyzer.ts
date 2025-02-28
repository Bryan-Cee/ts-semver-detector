import * as ts from 'typescript';
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
      console.log(`Analyzing files: ${oldSourceFile.fileName} -> ${newSourceFile.fileName}`);
      
      const oldExports = this.parser.getExportedDeclarations(oldSourceFile);
      console.log(`Found ${oldExports.length} exports in old file`);
      
      const newExports = this.parser.getExportedDeclarations(newSourceFile);
      console.log(`Found ${newExports.length} exports in new file`);

      const changes: Change[] = [];
      const oldExportMap = new Map<string, ts.Declaration[]>();
      const newExportMap = new Map<string, ts.Declaration[]>();

      // Group declarations by name
      console.log('Grouping old declarations by name');
      this.groupDeclarationsByName(oldExports, oldExportMap);
      console.log(`Grouped ${oldExportMap.size} old declarations`);
      
      console.log('Grouping new declarations by name');
      this.groupDeclarationsByName(newExports, newExportMap);
      console.log(`Grouped ${newExportMap.size} new declarations`);

      // Check for removed declarations
      console.log('Checking for removed declarations');
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
      console.log('Checking for added and modified declarations');
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
                console.log(`Rule ${rule.constructor.name} can handle ${name}`);
                
                // Skip if this node has been already processed with overrideDefault
                const nodeKey = `${oldDeclarations[0].pos}-${newDeclarations[0].pos}`;
                if (handledNodes.has(nodeKey)) {
                  console.log(`Skipping already handled node ${name}`);
                  continue;
                }
                
                const ruleChanges = rule.analyze(
                  oldDeclarations[0],
                  newDeclarations[0]
                );
                
                console.log(`Rule ${rule.constructor.name} found ${ruleChanges.length} changes for ${name}`);
                
                // Check if any changes should override default behavior
                for (const change of ruleChanges) {
                  if (change.details?.overrideDefault) {
                    handledNodes.add(nodeKey);
                    console.log(`Marking ${name} as handled with override`);
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

      console.log(`Analysis complete. Found ${changes.length} changes.`);
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
      console.log(`Getting name for node kind: ${ts.SyntaxKind[node.kind]}`);
      
      // Special handling for different node types
      if (ts.isVariableDeclaration(node)) {
        console.log('Node is VariableDeclaration');
        if (node.name && ts.isIdentifier(node.name)) {
          console.log(`Found identifier name: ${node.name.text}`);
          return node.name.text;
        } else if (node.name && typeof (node.name as ts.Node).getText === 'function') {
          const text = (node.name as ts.Node).getText();
          console.log(`Got name via getText: ${text}`);
          return text;
        }
      } 
      
      // Handle common declaration types with name property
      if (ts.isFunctionDeclaration(node) || 
          ts.isClassDeclaration(node) || 
          ts.isInterfaceDeclaration(node) || 
          ts.isTypeAliasDeclaration(node)) {
        
        console.log(`Node is ${ts.SyntaxKind[node.kind]}`);
        // Some declarations might have an optional name (like default exports)
        if (node.name) {
          console.log('Node has name property');
          if (ts.isIdentifier(node.name)) {
            console.log(`Found identifier name: ${node.name.text}`);
            return node.name.text;
          } else if (typeof (node.name as ts.Node).getText === 'function') {
            const text = (node.name as ts.Node).getText();
            console.log(`Got name via getText: ${text}`);
            return text;
          } else {
            console.log(`Name property type: ${typeof node.name}, isIdentifier: ${ts.isIdentifier(node.name)}`);
          }
        } else {
          console.log('Node does not have name property');
        }
      }
      
      // Try to get name from node.name if it exists
      if ('name' in node && node.name) {
        console.log('Trying to get name from node.name property');
        const nameNode = node.name as ts.Node;
        console.log(`Name node type: ${typeof nameNode}`);
        
        if (ts.isIdentifier(nameNode)) {
          console.log(`Found identifier name: ${nameNode.text}`);
          return nameNode.text;
        } else if (typeof nameNode.getText === 'function') {
          const text = nameNode.getText();
          console.log(`Got name via getText: ${text}`);
          return text;
        } else if (typeof nameNode === 'string') {
          console.log(`Name is string: ${nameNode}`);
          return nameNode as string;
        } else {
          console.log('Could not extract name from nameNode');
        }
      }
      
      // Try to get name from symbol
      if ('symbol' in node && node.symbol) {
        console.log('Trying to get name from symbol');
        const symbol = node.symbol as ts.Symbol;
        if (symbol && typeof symbol === 'object' && 'name' in symbol) {
          console.log(`Found symbol name: ${symbol.name}`);
          return symbol.name as string;
        } else {
          console.log('Symbol does not have name property');
        }
      }
      
      // Try to get name from the node's text if it's short enough
      if (typeof (node as ts.Node).getText === 'function') {
        console.log('Trying to get name from node text');
        try {
          const text = (node as ts.Node).getText();
          if (text && text.length < 100) { // Avoid huge texts
            console.log(`Using node text as name: ${text}`);
            return text;
          } else {
            console.log('Node text too long to use as name');
          }
        } catch (e) {
          console.log('Error getting node text:', e);
        }
      }
      
      // Generate a unique identifier based on position
      console.log('Generating name based on position');
      const sourceFile = node.getSourceFile();
      if (sourceFile) {
        try {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const fileName = sourceFile.fileName.split('/').pop() || 'unknown';
          const name = `anonymous_${fileName}_${pos.line}_${pos.character}`;
          console.log(`Generated position-based name: ${name}`);
          return name;
        } catch (e) {
          console.log('Error getting position:', e);
          // If we can't get position, use kind and raw position
          const name = `anonymous_${ts.SyntaxKind[node.kind]}_${node.pos}`;
          console.log(`Generated fallback name: ${name}`);
          return name;
        }
      } else {
        console.log('No source file available');
      }
      
      // Last resort fallback
      const name = `anonymous_${ts.SyntaxKind[node.kind]}_${Date.now()}`;
      console.log(`Generated last resort name: ${name}`);
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
    try {
      const sourceFile = node.getSourceFile();
      if (!sourceFile) {
        console.warn('Source file not found for node');
        return {
          line: 0,
          column: 0
        };
      }
      
      try {
        const start = node.getStart();
        const pos = sourceFile.getLineAndCharacterOfPosition(start);
        return {
          line: pos.line + 1,
          column: pos.character + 1
        };
      } catch (posError) {
        // If we can't get the start position, try the raw pos
        try {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.pos);
          return {
            line: pos.line + 1,
            column: pos.character + 1
          };
        } catch (e) {
          console.warn('Failed to get position from node', e);
          return {
            line: 0,
            column: 0
          };
        }
      }
    } catch (error) {
      console.error(`Error getting node position for node kind: ${ts.SyntaxKind[node.kind]}`, error);
      return {
        line: 0,
        column: 0
      };
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

