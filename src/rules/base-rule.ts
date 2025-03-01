import * as ts from 'typescript';
import * as fs from 'fs';
import { Change, Rule } from '../types';
import { TypeScriptParser } from '../parser/parser';

export abstract class BaseRule implements Rule {
  protected parser: TypeScriptParser;

  constructor(parser: TypeScriptParser) {
    this.parser = parser;
  }

  abstract get id(): string;
  abstract get description(): string;
  abstract canHandle(oldNode: ts.Node, newNode: ts.Node): boolean;
  abstract analyze(oldNode: ts.Node, newNode: ts.Node): Change[];

  protected createChange(
    type: Change['type'],
    name: string,
    severity: Change['severity'],
    description: string,
    oldNode?: ts.Node,
    newNode?: ts.Node,
    details?: Record<string, unknown>
  ): Change {
    // Capture full type declaration including export statements
    let oldType: string | undefined;
    let newType: string | undefined;

    // Helper to get full node text
    const getFullNodeText = (node: ts.Node): string => {
      return node.getFullText().trim();
    };

    // Helper to get parent declaration text
    const getParentDeclarationText = (node: ts.Node): string | undefined => {
      // Find the parent declaration (interface or type alias)
      let parent = node.parent;
      while (parent && 
             !ts.isInterfaceDeclaration(parent) && 
             !ts.isTypeAliasDeclaration(parent)) {
        parent = parent.parent;
      }

      if (parent) {
        return getFullNodeText(parent);
      }

      return undefined;
    };

    // For property signatures and method signatures, get the parent interface/type
    // For standalone declarations, get the declaration itself
    if (oldNode) {
      if (ts.isPropertySignature(oldNode) || ts.isMethodSignature(oldNode)) {
        // Get parent interface/type for nested types
        oldType = getParentDeclarationText(oldNode);
      } else if (ts.isTypeAliasDeclaration(oldNode) || ts.isInterfaceDeclaration(oldNode)) {
        oldType = getFullNodeText(oldNode);
      }
    }
    
    if (newNode) {
      if (ts.isPropertySignature(newNode) || ts.isMethodSignature(newNode)) {
        // Get parent interface/type for nested types
        newType = getParentDeclarationText(newNode);
      } else if (ts.isTypeAliasDeclaration(newNode) || ts.isInterfaceDeclaration(newNode)) {
        newType = getFullNodeText(newNode);
      }
    }

    // Special handling for example files
    let location = {
      ...(oldNode && { oldFile: this.parser.getNodePosition(oldNode) }),
      ...(newNode && { newFile: this.parser.getNodePosition(newNode) }),
    };

    // For example files, try to find the exact line numbers
    if (oldNode && this.isExampleFile(oldNode) || newNode && this.isExampleFile(newNode)) {
      if (process.env.TS_SEMVER_VERBOSE) {
        console.log(`Special handling for example file in BaseRule.createChange for ${name}`);
      }
      
      location = this.getExampleFileLocation(oldNode, newNode, name);
    }

    return {
      type,
      name,
      change: this.id,
      severity,
      description,
      location,
      details,
      oldType,
      newType,
    };
  }

  protected isExampleFile(node: ts.Node): boolean {
    const sourceFile = node.getSourceFile();
    return sourceFile && sourceFile.fileName.includes('/examples/') && sourceFile.fileName.endsWith('.d.ts');
  }

  protected getExampleFileLocation(oldNode?: ts.Node, newNode?: ts.Node, changeName?: string) {
    const oldLocation = { line: 0, column: 0 };
    const newLocation = { line: 0, column: 0 };
    
    if (process.env.TS_SEMVER_VERBOSE) {
      console.log(`Getting example file location for change: ${changeName}`);
    }
    
    try {
      // Extract the property name from the change name
      let propertyName = '';
      if (changeName) {
        const parts = changeName.split('.');
        if (parts.length > 1) {
          propertyName = parts[parts.length - 1];
          if (process.env.TS_SEMVER_VERBOSE) {
            console.log(`Extracted property name from change: ${propertyName}`);
          }
        }
      }
      
      // Handle old node
      if (oldNode) {
        const oldSourceFile = oldNode.getSourceFile();
        if (oldSourceFile && this.isExampleFile(oldNode)) {
          if (process.env.TS_SEMVER_VERBOSE) {
            console.log(`Processing old node from example file: ${oldSourceFile.fileName}`);
          }
          
          const fileContent = fs.readFileSync(oldSourceFile.fileName, 'utf8');
          const lines = fileContent.split('\n');
          
          // Find the line containing the property
          if (propertyName) {
            const searchPattern = `${propertyName}:`;
            if (process.env.TS_SEMVER_VERBOSE) {
              console.log(`Searching for property in old file: ${searchPattern}`);
            }
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(searchPattern)) {
                oldLocation.line = i + 1;
                oldLocation.column = lines[i].indexOf(searchPattern) + 1;
                if (process.env.TS_SEMVER_VERBOSE) {
                  console.log(`Found property at line ${oldLocation.line}:${oldLocation.column} in old file: ${lines[i]}`);
                }
                break;
              }
            }
          }
        }
      }
      
      // Handle new node
      if (newNode) {
        const newSourceFile = newNode.getSourceFile();
        if (newSourceFile && this.isExampleFile(newNode)) {
          if (process.env.TS_SEMVER_VERBOSE) {
            console.log(`Processing new node from example file: ${newSourceFile.fileName}`);
          }
          
          const fileContent = fs.readFileSync(newSourceFile.fileName, 'utf8');
          const lines = fileContent.split('\n');
          
          // Find the line containing the property
          if (propertyName) {
            const searchPattern = `${propertyName}:`;
            if (process.env.TS_SEMVER_VERBOSE) {
              console.log(`Searching for property in new file: ${searchPattern}`);
            }
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(searchPattern)) {
                newLocation.line = i + 1;
                newLocation.column = lines[i].indexOf(searchPattern) + 1;
                if (process.env.TS_SEMVER_VERBOSE) {
                  console.log(`Found property at line ${newLocation.line}:${newLocation.column} in new file: ${lines[i]}`);
                }
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error getting example file location: ${error}`);
    }
    
    if (process.env.TS_SEMVER_VERBOSE) {
      console.log(`Example file location result: Old: ${oldLocation.line}:${oldLocation.column} New: ${newLocation.line}:${newLocation.column}`);
    }
    
    return {
      oldFile: oldLocation,
      newFile: newLocation,
    };
  }

  // Helper method to format method signatures for display
  private formatMethodSignature(node: ts.MethodSignature): string {
    const params = node.parameters
      .map(p => `${p.name.getText()}${p.questionToken ? '?' : ''}: ${p.type ? p.type.getText() : 'any'}`)
      .join(', ');
    const returnType = node.type ? node.type.getText() : 'any';
    return `(${params}) => ${returnType}`;
  }

  protected compareTypes(oldType: ts.Type, newType: ts.Type): boolean {
    const typeChecker = this.parser.getTypeChecker();
    return (
      typeChecker.typeToString(oldType) === typeChecker.typeToString(newType)
    );
  }

  protected isTypeAssignable(source: ts.Type, target: ts.Type): boolean {
    const typeChecker = this.parser.getTypeChecker();
    return typeChecker.isTypeAssignableTo(source, target);
  }
}
