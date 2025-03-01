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
    
    try {
      // Cast to function declarations
      const oldFunc = oldNode as ts.FunctionDeclaration;
      const newFunc = newNode as ts.FunctionDeclaration;
      
      // Get function name
      let funcName = 'anonymous';
      try {
        funcName = oldFunc.name ? this.parser.getNodeText(oldFunc.name) : 'anonymous';
      } catch (e) {
        console.error(`Error getting function name: ${e}`);
      }
      
      // Compare return types
      let oldReturnType: string | undefined;
      let newReturnType: string | undefined;
      
      try {
        oldReturnType = oldFunc.type ? this.parser.getNodeText(oldFunc.type) : undefined;
      } catch (e) {
        console.error(`Error getting old return type: ${e}`);
      }
      
      try {
        newReturnType = newFunc.type ? this.parser.getNodeText(newFunc.type) : undefined;
      } catch (e) {
        console.error(`Error getting new return type: ${e}`);
      }
      
      if (oldReturnType !== newReturnType && oldReturnType && newReturnType) {
        changes.push(
          this.createChange(
            'function',
            funcName,
            'major',
            `Changed return type from '${oldReturnType}' to '${
              newReturnType || 'any'
            }'`,
            oldFunc,
            newFunc
          )
        );
      }

      // Compare parameters
      try {
        const oldParams = oldFunc.parameters;
        const newParams = newFunc.parameters;

        // Check for removed parameters
        for (let i = 0; i < oldParams.length; i++) {
          try {
            const oldParam = oldParams[i];
            const newParam = newParams[i];

            if (!newParam) {
              let paramName = 'unknown';
              try {
                paramName = oldParam.name ? this.parser.getNodeText(oldParam.name) : 'unknown';
              } catch (e) {
                console.error(`Error getting parameter name: ${e}`);
              }
              
              changes.push(
                this.createChange(
                  'function',
                  funcName,
                  'major',
                  `Removed parameter '${paramName}'`,
                  oldParam
                )
              );
              continue;
            }

            // Compare parameter types
            let oldParamType: string | undefined;
            let newParamType: string | undefined;
            let paramName = 'unknown';
            
            try {
              paramName = oldParam.name ? this.parser.getNodeText(oldParam.name) : 'unknown';
            } catch (e) {
              console.error(`Error getting parameter name: ${e}`);
            }
            
            try {
              oldParamType = oldParam.type ? this.parser.getNodeText(oldParam.type) : undefined;
            } catch (e) {
              console.error(`Error getting old parameter type: ${e}`);
            }
            
            try {
              newParamType = newParam.type ? this.parser.getNodeText(newParam.type) : undefined;
            } catch (e) {
              console.error(`Error getting new parameter type: ${e}`);
            }
            
            if (oldParamType !== newParamType && oldParamType && newParamType) {
              changes.push(
                this.createChange(
                  'function',
                  `${funcName}.${paramName}`,
                  'major',
                  `Changed parameter type from '${oldParamType}' to '${newParamType}'`,
                  oldParam,
                  newParam
                )
              );
            }

            // Check if parameter became optional
            const oldOptional = !!oldParam.questionToken;
            const newOptional = !!newParam.questionToken;

            if (!oldOptional && newOptional) {
              changes.push(
                this.createChange(
                  'function',
                  `${funcName}.${paramName}`,
                  'minor',
                  `Parameter '${paramName}' became optional`,
                  oldParam,
                  newParam
                )
              );
            } else if (oldOptional && !newOptional) {
              changes.push(
                this.createChange(
                  'function',
                  `${funcName}.${paramName}`,
                  'major',
                  `Parameter '${paramName}' became required`,
                  oldParam,
                  newParam
                )
              );
            }
          } catch (e) {
            console.error(`Error comparing parameter at index ${i}: ${e}`);
          }
        }

        // Check for added parameters
        for (let i = oldParams.length; i < newParams.length; i++) {
          try {
            const newParam = newParams[i];
            const isOptional = !!newParam.questionToken || !!newParam.initializer;
            
            let paramName = 'unknown';
            try {
              paramName = newParam.name ? this.parser.getNodeText(newParam.name) : 'unknown';
            } catch (e) {
              console.error(`Error getting parameter name: ${e}`);
            }
            
            changes.push(
              this.createChange(
                'function',
                `${funcName}.${paramName}`,
                isOptional ? 'minor' : 'major',
                `Added ${isOptional ? 'optional' : 'required'} parameter '${paramName}'`,
                newParam
              )
            );
          } catch (e) {
            console.error(`Error checking added parameter at index ${i}: ${e}`);
          }
        }
      } catch (e) {
        console.error(`Error comparing parameters: ${e}`);
      }

      // Compare type parameters
      const oldTypeParams = oldFunc.typeParameters?.length ?? 0;
      const newTypeParams = newFunc.typeParameters?.length ?? 0;

      if (oldTypeParams !== newTypeParams) {
        changes.push(
          this.createChange(
            'function',
            funcName,
            'major',
            `Changed number of type parameters from ${oldTypeParams} to ${newTypeParams}`,
            oldFunc,
            newFunc
          )
        );
      }
    } catch (e) {
      console.error(`Error in FunctionRule.analyze: ${e}`);
    }

    return changes;
  }
}
