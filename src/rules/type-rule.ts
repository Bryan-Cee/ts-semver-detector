import * as ts from 'typescript';
import { BaseRule } from './base-rule';
import { Change } from '../types';
import { TypeScriptParser } from '../parser/parser';

export class TypeRule extends BaseRule {
  constructor(parser: TypeScriptParser) {
    super(parser);
  }

  get id(): string {
    return 'type';
  }

  get description(): string {
    return 'Analyzes changes in type alias declarations';
  }

  public canHandle(oldNode: ts.Declaration, newNode: ts.Declaration): boolean {
    return ts.isTypeAliasDeclaration(oldNode) && ts.isTypeAliasDeclaration(newNode);
  }

  public analyze(oldNode: ts.Declaration, newNode: ts.Declaration): Change[] {
    if (!this.canHandle(oldNode, newNode)) {
      return [];
    }

    const oldType = oldNode as ts.TypeAliasDeclaration;
    const newType = newNode as ts.TypeAliasDeclaration;
    const name = this.getNodeName(newType);
    const changes: Change[] = [];

    try {
      // Check type parameters (generics)
      const typeParamsAdded = this.checkTypeParametersAdded(oldType, newType);
      if (typeParamsAdded) {
        changes.push({
          type: 'type',
          change: 'typeParameters',
          name,
          severity: 'major',
          description: `Type parameters added to type ${name}`,
          location: this.createChangeLocation(oldType, newType),
        });
      }

      // Check if type has changed
      const typeChanged = this.hasTypeChanged(oldType.type, newType.type);
      if (typeChanged) {
        changes.push({
          type: 'type',
          change: 'typeDefinition',
          name,
          severity: 'major',
          description: `Type definition changed for ${name}`,
          location: this.createChangeLocation(oldType, newType),
          details: {
            oldType: this.getTypeNodeText(oldType.type),
            newType: this.getTypeNodeText(newType.type),
          },
        });
      }

      return changes;
    } catch (error) {
      console.error(`Error analyzing type alias ${name}:`, error);
      return [];
    }
  }

  private hasTypeChanged(oldTypeNode: ts.TypeNode, newTypeNode: ts.TypeNode): boolean {
    if (!oldTypeNode || !newTypeNode) {
      return true;
    }

    try {
      const oldText = this.getTypeNodeText(oldTypeNode);
      const newText = this.getTypeNodeText(newTypeNode);

      if (oldText !== newText) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error comparing type nodes:', error);
      // If we can't properly compare, assume they are different to be safe
      return true;
    }
  }

  private checkTypeParametersAdded(
    oldType: ts.TypeAliasDeclaration,
    newType: ts.TypeAliasDeclaration
  ): boolean {
    const oldParams = oldType.typeParameters || [];
    const newParams = newType.typeParameters || [];

    // If new params were added, it's a breaking change
    return oldParams.length < newParams.length;
  }

  private getTypeNodeText(typeNode: ts.TypeNode): string {
    if (!typeNode) {
      return '';
    }

    try {
      // Use the parser's robust method to get text
      return this.parser.getNodeText(typeNode);
    } catch (error) {
      console.error('Error getting type node text:', error);
      
      // Return a generic string as last resort
      if (ts.isUnionTypeNode(typeNode)) {
        return 'union-type';
      } else if (ts.isIntersectionTypeNode(typeNode)) {
        return 'intersection-type';
      } else if (ts.isTypeLiteralNode(typeNode)) {
        return 'object-type';
      }
      
      return '';
    }
  }

  protected getNodeName(node: ts.Node): string {
    if (ts.isTypeAliasDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name.text;
    }
    return 'unknown';
  }

  protected createChangeLocation(oldNode: ts.Node, newNode: ts.Node) {
    return {
      oldFile: this.getNodePosition(oldNode),
      newFile: this.getNodePosition(newNode),
    };
  }

  private getNodePosition(node: ts.Node) {
    try {
      const sourceFile = node.getSourceFile();
      if (!sourceFile) {
        return { line: 0, column: 0 };
      }

      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      return {
        line: pos.line + 1,
        column: pos.character + 1,
      };
    } catch (error) {
      return { line: 0, column: 0 };
    }
  }
}
