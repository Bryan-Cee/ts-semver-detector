import * as ts from 'typescript';
import { BaseRule } from './base-rule';
import { Change } from '../types';

export class FunctionRule extends BaseRule {
  get id(): string {
    return 'function';
  }

  get description(): string {
    return 'Analyzes changes in function declarations';
  }

  canHandle(oldNode: ts.Node, newNode: ts.Node): boolean {
    return (
      ts.isFunctionDeclaration(oldNode) && ts.isFunctionDeclaration(newNode)
    );
  }

  analyze(oldNode: ts.Node, newNode: ts.Node): Change[] {
    if (!this.canHandle(oldNode, newNode)) {
      return [];
    }

    const changes: Change[] = [];
    const oldFunc = oldNode as ts.FunctionDeclaration;
    const newFunc = newNode as ts.FunctionDeclaration;

    // Compare return types
    const oldReturnType = oldFunc.type?.getText();
    const newReturnType = newFunc.type?.getText();

    if (oldReturnType !== newReturnType) {
      changes.push(
        this.createChange(
          'function',
          oldFunc.name?.text || 'anonymous',
          'major',
          `Changed return type from '${oldReturnType || 'any'}' to '${
            newReturnType || 'any'
          }'`,
          oldFunc,
          newFunc
        )
      );
    }

    // Compare parameters
    const oldParams = oldFunc.parameters;
    const newParams = newFunc.parameters;

    // Check for removed parameters
    for (let i = 0; i < oldParams.length; i++) {
      const oldParam = oldParams[i];
      const newParam = newParams[i];

      if (!newParam) {
        changes.push(
          this.createChange(
            'function',
            oldFunc.name?.text || 'anonymous',
            'major',
            `Removed parameter '${oldParam.name.getText()}'`,
            oldParam
          )
        );
        continue;
      }

      // Compare parameter types
      const oldParamType = oldParam.type?.getText();
      const newParamType = newParam.type?.getText();

      if (oldParamType !== newParamType) {
        changes.push(
          this.createChange(
            'function',
            oldFunc.name?.text || 'anonymous',
            'major',
            `Changed type of parameter '${oldParam.name.getText()}' from '${
              oldParamType || 'any'
            }' to '${newParamType || 'any'}'`,
            oldParam,
            newParam
          )
        );
      }

      // Compare parameter optionality
      const wasOptional =
        oldParam.questionToken !== undefined ||
        oldParam.initializer !== undefined;
      const isOptional =
        newParam.questionToken !== undefined ||
        newParam.initializer !== undefined;

      if (wasOptional !== isOptional) {
        changes.push(
          this.createChange(
            'function',
            oldFunc.name?.text || 'anonymous',
            wasOptional ? 'major' : 'minor',
            `Changed parameter '${oldParam.name.getText()}' from ${
              wasOptional ? 'optional' : 'required'
            } to ${isOptional ? 'optional' : 'required'}`,
            oldParam,
            newParam
          )
        );
      }
    }

    // Check for added parameters
    for (let i = oldParams.length; i < newParams.length; i++) {
      const newParam = newParams[i];
      const isOptional =
        newParam.questionToken !== undefined ||
        newParam.initializer !== undefined;

      changes.push(
        this.createChange(
          'function',
          oldFunc.name?.text || 'anonymous',
          isOptional ? 'minor' : 'major',
          `Added ${
            isOptional ? 'optional' : 'required'
          } parameter '${newParam.name.getText()}'`,
          undefined,
          newParam
        )
      );
    }

    // Compare type parameters
    const oldTypeParams = oldFunc.typeParameters?.length ?? 0;
    const newTypeParams = newFunc.typeParameters?.length ?? 0;

    if (oldTypeParams !== newTypeParams) {
      changes.push(
        this.createChange(
          'function',
          oldFunc.name?.text || 'anonymous',
          'major',
          `Changed number of type parameters from ${oldTypeParams} to ${newTypeParams}`,
          oldFunc,
          newFunc
        )
      );
    }

    return changes;
  }
}
