import * as ts from 'typescript';
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

    return {
      type,
      name,
      change: this.id,
      severity,
      description,
      details,
      oldType,
      newType,
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
