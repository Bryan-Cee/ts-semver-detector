import * as ts from 'typescript';
import { BaseRule } from './base-rule';
import { Change } from '../types';

export class ClassRule extends BaseRule {
  get id(): string {
    return 'class';
  }

  get description(): string {
    return 'Analyzes changes in class declarations';
  }

  canHandle(oldNode: ts.Node, newNode: ts.Node): boolean {
    return ts.isClassDeclaration(oldNode) && ts.isClassDeclaration(newNode);
  }

  analyze(oldNode: ts.Node, newNode: ts.Node): Change[] {
    if (!this.canHandle(oldNode, newNode)) {
      return [];
    }

    const changes: Change[] = [];
    const oldClass = oldNode as ts.ClassDeclaration;
    const newClass = newNode as ts.ClassDeclaration;

    // Compare heritage clauses (extends and implements)
    const oldHeritage = this.getHeritageInfo(oldClass);
    const newHeritage = this.getHeritageInfo(newClass);

    if (oldHeritage.baseClass !== newHeritage.baseClass) {
      changes.push(
        this.createChange(
          'class',
          oldClass.name?.text || 'anonymous',
          'major',
          `Changed base class from '${oldHeritage.baseClass || 'none'}' to '${
            newHeritage.baseClass || 'none'
          }'`,
          oldClass,
          newClass
        )
      );
    }

    const removedInterfaces = oldHeritage.interfaces.filter(
      (i) => !newHeritage.interfaces.includes(i)
    );
    const addedInterfaces = newHeritage.interfaces.filter(
      (i) => !oldHeritage.interfaces.includes(i)
    );

    if (removedInterfaces.length > 0) {
      changes.push(
        this.createChange(
          'class',
          oldClass.name?.text || 'anonymous',
          'major',
          `Removed implemented interfaces: ${removedInterfaces.join(', ')}`,
          oldClass
        )
      );
    }

    if (addedInterfaces.length > 0) {
      changes.push(
        this.createChange(
          'class',
          oldClass.name?.text || 'anonymous',
          'minor',
          `Added implemented interfaces: ${addedInterfaces.join(', ')}`,
          undefined,
          newClass
        )
      );
    }

    // Compare members
    const oldMembers = this.getMemberMap(oldClass);
    const newMembers = this.getMemberMap(newClass);

    // Check for removed members
    for (const [name, oldMember] of oldMembers) {
      if (!newMembers.has(name)) {
        changes.push(
          this.createChange(
            'class',
            `${oldClass.name?.text || 'anonymous'}.${name}`,
            'major',
            `Removed member '${name}'`,
            oldMember
          )
        );
      }
    }

    // Check for added or modified members
    for (const [name, newMember] of newMembers) {
      const oldMember = oldMembers.get(name);

      if (!oldMember) {
        const isPublic = !this.isPrivate(newMember);
        if (isPublic) {
          changes.push(
            this.createChange(
              'class',
              `${newClass.name?.text || 'anonymous'}.${name}`,
              'minor',
              `Added public member '${name}'`,
              undefined,
              newMember
            )
          );
        }
        continue;
      }

      // Compare visibility
      const oldVisibility = this.getVisibility(oldMember);
      const newVisibility = this.getVisibility(newMember);

      if (oldVisibility !== newVisibility) {
        changes.push(
          this.createChange(
            'class',
            `${oldClass.name?.text || 'anonymous'}.${name}`,
            'major',
            `Changed visibility of '${name}' from ${oldVisibility} to ${newVisibility}`,
            oldMember,
            newMember
          )
        );
      }

      // Compare types for properties and methods
      if (
        ts.isPropertyDeclaration(oldMember) &&
        ts.isPropertyDeclaration(newMember)
      ) {
        const oldType = oldMember.type?.getText();
        const newType = newMember.type?.getText();

        if (oldType !== newType) {
          changes.push(
            this.createChange(
              'class',
              `${oldClass.name?.text || 'anonymous'}.${name}`,
              'major',
              `Changed type of property '${name}' from '${
                oldType || 'any'
              }' to '${newType || 'any'}'`,
              oldMember,
              newMember
            )
          );
        }
      } else if (
        ts.isMethodDeclaration(oldMember) &&
        ts.isMethodDeclaration(newMember)
      ) {
        // Compare method signatures
        const oldReturnType = oldMember.type?.getText() || 'any';
        const newReturnType = newMember.type?.getText() || 'any';

        // Check return type changes first
        if (oldReturnType !== newReturnType) {
          changes.push(
            this.createChange(
              'class',
              `${oldClass.name?.text || 'anonymous'}.${name}`,
              'major',
              `Changed return type of method '${name}' from '${oldReturnType}' to '${newReturnType}'`,
              oldMember,
              newMember
            )
          );
        }

        // Compare parameters
        const oldParams = oldMember.parameters;
        const newParams = newMember.parameters;

        // Check for removed parameters
        for (const oldParam of oldParams) {
          const oldParamName = oldParam.name.getText();
          const newParam = newParams.find(
            (p) => p.name.getText() === oldParamName
          );

          if (!newParam) {
            changes.push(
              this.createChange(
                'class',
                `${oldClass.name?.text || 'anonymous'}.${name}`,
                'major',
                `Removed parameter '${oldParamName}' from method '${name}'`,
                oldMember,
                newMember
              )
            );
            continue;
          }

          // Compare parameter types
          const oldParamType = oldParam.type?.getText() || 'any';
          const newParamType = newParam.type?.getText() || 'any';
          if (oldParamType !== newParamType) {
            changes.push(
              this.createChange(
                'class',
                `${oldClass.name?.text || 'anonymous'}.${name}`,
                'major',
                `Changed type of parameter '${oldParamName}' in method '${name}' from '${oldParamType}' to '${newParamType}'`,
                oldMember,
                newMember
              )
            );
          }

          // Compare parameter optionality
          const oldOptional = oldParam.questionToken !== undefined;
          const newOptional = newParam.questionToken !== undefined;
          if (oldOptional !== newOptional) {
            changes.push(
              this.createChange(
                'class',
                `${oldClass.name?.text || 'anonymous'}.${name}`,
                newOptional ? 'minor' : 'major',
                newOptional
                  ? `Made parameter '${oldParamName}' optional in method '${name}'`
                  : `Made parameter '${oldParamName}' required in method '${name}'`,
                oldMember,
                newMember
              )
            );
          }
        }

        // Check for added parameters
        for (const newParam of newParams) {
          const newParamName = newParam.name.getText();
          const oldParam = oldParams.find(
            (p) => p.name.getText() === newParamName
          );

          if (!oldParam) {
            changes.push(
              this.createChange(
                'class',
                `${oldClass.name?.text || 'anonymous'}.${name}`,
                newParam.questionToken ? 'minor' : 'major',
                `Added ${
                  newParam.questionToken ? 'optional' : 'required'
                } parameter '${newParamName}' to method '${name}'`,
                oldMember,
                newMember
              )
            );
          }
        }
      }
    }

    return changes;
  }

  private getHeritageInfo(node: ts.ClassDeclaration) {
    let baseClass: string | undefined;
    const interfaces: string[] = [];

    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (
          clause.token === ts.SyntaxKind.ExtendsKeyword &&
          clause.types.length > 0
        ) {
          baseClass = clause.types[0].getText();
        } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          interfaces.push(...clause.types.map((t) => t.getText()));
        }
      }
    }

    return { baseClass, interfaces };
  }

  private getMemberMap(
    node: ts.ClassDeclaration
  ): Map<string, ts.ClassElement> {
    const members = new Map<string, ts.ClassElement>();

    for (const member of node.members) {
      if (ts.isPropertyDeclaration(member) || ts.isMethodDeclaration(member)) {
        const name = member.name.getText();
        members.set(name, member);
      }
    }

    return members;
  }

  private isPrivate(node: ts.ClassElement): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    const modifiers = ts.getModifiers(node);
    return (
      modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword) ?? false
    );
  }

  private getVisibility(
    node: ts.ClassElement
  ): 'private' | 'protected' | 'public' {
    if (!ts.canHaveModifiers(node)) return 'public';
    const modifiers = ts.getModifiers(node);
    if (!modifiers) return 'public';

    if (modifiers.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword)) {
      return 'private';
    }
    if (modifiers.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword)) {
      return 'protected';
    }
    return 'public';
  }

  private getMethodSignature(method: ts.MethodDeclaration): string {
    const params = method.parameters
      .map((p) => {
        const isOptional = p.questionToken !== undefined;
        const type = p.type ? p.type.getText() : 'any';
        return `${p.name.getText()}${isOptional ? '?' : ''}: ${type}`;
      })
      .join(', ');
    const returnType = method.type ? method.type.getText() : 'any';
    return `(${params}) => ${returnType}`;
  }

  private compareMethodSignatures(
    oldMethod: ts.MethodDeclaration,
    newMethod: ts.MethodDeclaration
  ): Change[] {
    const changes: Change[] = [];
    const methodName = oldMethod.name.getText();

    // Compare return types
    if (oldMethod.type && newMethod.type) {
      const oldReturnType = oldMethod.type.getText();
      const newReturnType = newMethod.type.getText();
      if (oldReturnType !== newReturnType) {
        changes.push(
          this.createChange(
            'class',
            `${methodName}`,
            'major',
            `Changed return type of method '${methodName}' from '${oldReturnType}' to '${newReturnType}'`,
            oldMethod,
            newMethod
          )
        );
      }
    }

    // Compare parameters
    const oldParams = oldMethod.parameters;
    const newParams = newMethod.parameters;

    // Check for removed parameters
    for (const oldParam of oldParams) {
      const paramName = oldParam.name.getText();
      const newParam = newParams.find((p) => p.name.getText() === paramName);
      if (!newParam) {
        changes.push(
          this.createChange(
            'class',
            `${methodName}.${paramName}`,
            'major',
            `Removed parameter '${paramName}' from method '${methodName}'`,
            oldParam
          )
        );
      }
    }

    // Check for added parameters
    for (const newParam of newParams) {
      const paramName = newParam.name.getText();
      const oldParam = oldParams.find((p) => p.name.getText() === paramName);
      if (!oldParam) {
        const isOptional = newParam.questionToken !== undefined;
        changes.push(
          this.createChange(
            'class',
            `${methodName}.${paramName}`,
            isOptional ? 'minor' : 'major',
            `Added ${
              isOptional ? 'optional' : 'required'
            } parameter '${paramName}' to method '${methodName}'`,
            undefined,
            newParam
          )
        );
      }
    }

    // Compare parameter types
    for (const newParam of newParams) {
      const paramName = newParam.name.getText();
      const oldParam = oldParams.find((p) => p.name.getText() === paramName);
      if (oldParam && oldParam.type && newParam.type) {
        const oldType = oldParam.type.getText();
        const newType = newParam.type.getText();
        if (oldType !== newType) {
          changes.push(
            this.createChange(
              'class',
              `${methodName}.${paramName}`,
              'major',
              `Changed type of parameter '${paramName}' in method '${methodName}' from '${oldType}' to '${newType}'`,
              oldParam,
              newParam
            )
          );
        }
      }
    }

    return changes;
  }
}
