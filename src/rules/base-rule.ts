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
    return {
      type,
      name,
      change: this.id,
      severity,
      description,
      location: {
        ...(oldNode && { oldFile: this.parser.getNodePosition(oldNode) }),
        ...(newNode && { newFile: this.parser.getNodePosition(newNode) }),
      },
      details,
    };
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
