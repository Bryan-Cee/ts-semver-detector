import * as ts from 'typescript';
import { BaseRule } from './base-rule';
import { Change } from '../types';

export class TypeInterfaceConversionRule extends BaseRule {
  get id(): string {
    return 'type-interface-conversion';
  }

  get description(): string {
    return 'Analyzes conversions between type aliases and interfaces';
  }

  canHandle(oldNode: ts.Node, newNode: ts.Node): boolean {
    return (
      (ts.isTypeAliasDeclaration(oldNode) && ts.isInterfaceDeclaration(newNode)) ||
      (ts.isInterfaceDeclaration(oldNode) && ts.isTypeAliasDeclaration(newNode))
    );
  }

  analyze(oldNode: ts.Node, newNode: ts.Node): Change[] {
    if (!this.canHandle(oldNode, newNode)) {
      return [];
    }

    const changes: Change[] = [];
    const isTypeToInterface = ts.isTypeAliasDeclaration(oldNode) && ts.isInterfaceDeclaration(newNode);
    const name = isTypeToInterface ? oldNode.name.text : (oldNode as ts.InterfaceDeclaration).name.text;

    // Compare the structural types
    const typeChecker = this.parser.getTypeChecker();
    const oldType = typeChecker.getTypeAtLocation(oldNode);
    const newType = typeChecker.getTypeAtLocation(newNode);

    // Check if types are structurally compatible
    const isNewAssignableToOld = typeChecker.isTypeAssignableTo(newType, oldType);
    const isOldAssignableToNew = typeChecker.isTypeAssignableTo(oldType, newType);

    if (!isNewAssignableToOld || !isOldAssignableToNew) {
      // If types are not mutually assignable, it's a breaking change
      changes.push(
        this.createChange(
          isTypeToInterface ? 'type' : 'interface',
          name,
          'major',
          `Changed ${isTypeToInterface ? 'type alias to interface' : 'interface to type alias'} with incompatible structure`,
          oldNode,
          newNode
        )
      );
    } else {
      // If types are mutually assignable, it's a minor change
      // because interfaces are augmentable while type aliases are not
      changes.push(
        this.createChange(
          isTypeToInterface ? 'type' : 'interface',
          name,
          'minor',
          `Changed ${isTypeToInterface ? 'type alias to interface' : 'interface to type alias'} with compatible structure`,
          oldNode,
          newNode,
          {
            reason: isTypeToInterface
              ? 'Interface declarations are augmentable and can be extended'
              : 'Type aliases are not augmentable but preserve structural compatibility'
          }
        )
      );
    }

    return changes;
  }
} 