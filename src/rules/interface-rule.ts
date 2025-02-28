import * as ts from 'typescript';
import { BaseRule } from './base-rule';
import { Change } from '../types';

export class InterfaceRule extends BaseRule {
  get id(): string {
    return 'interface';
  }

  get description(): string {
    return 'Analyzes changes in interface declarations';
  }

  canHandle(oldNode: ts.Node, newNode: ts.Node): boolean {
    return (
      ts.isInterfaceDeclaration(oldNode) && ts.isInterfaceDeclaration(newNode)
    );
  }

  analyze(oldNode: ts.Node, newNode: ts.Node): Change[] {
    if (!this.canHandle(oldNode, newNode)) {
      return [];
    }

    const changes: Change[] = [];
    const oldInterface = oldNode as ts.InterfaceDeclaration;
    const newInterface = newNode as ts.InterfaceDeclaration;

    // Compare members
    const oldMembers = new Map<string, ts.TypeElement>();
    const newMembers = new Map<string, ts.TypeElement>();

    oldInterface.members.forEach((member) => {
      if (member.name) {
        oldMembers.set(member.name.getText(), member);
      }
    });

    newInterface.members.forEach((member) => {
      if (member.name) {
        newMembers.set(member.name.getText(), member);
      }
    });

    // Check for removed members
    for (const [name, oldMember] of oldMembers) {
      if (!newMembers.has(name)) {
        changes.push(
          this.createChange(
            'interface',
            `${oldInterface.name.text}.${name}`,
            'major',
            `Removed member '${name}'`,
            oldMember
          )
        );
      }
    }

    // Check for added and modified members
    for (const [name, newMember] of newMembers) {
      const oldMember = oldMembers.get(name);
      if (!oldMember) {
        const isOptional =
          ts.isPropertySignature(newMember) && newMember.questionToken;
        const isMethod = ts.isMethodSignature(newMember);
        changes.push(
          this.createChange(
            'interface',
            `${newInterface.name.text}.${name}`,
            isMethod || isOptional ? 'minor' : 'major',
            `Added ${
              isMethod
                ? 'method'
                : isOptional
                ? 'optional property'
                : 'required property'
            } '${name}'`,
            undefined,
            newMember
          )
        );
        continue;
      }

      // Compare types
      if (
        ts.isPropertySignature(oldMember) &&
        ts.isPropertySignature(newMember)
      ) {
        if (
          oldMember.type &&
          newMember.type &&
          oldMember.type.getText() !== newMember.type.getText()
        ) {
          changes.push(
            this.createChange(
              'interface',
              `${newInterface.name.text}.${name}`,
              'major',
              `Changed type of property '${name}' from '${oldMember.type.getText()}' to '${newMember.type.getText()}'`,
              oldMember,
              newMember
            )
          );
        }
      }

      // Compare method signatures
      if (ts.isMethodSignature(oldMember) && ts.isMethodSignature(newMember)) {
        const oldSignature = this.getMethodSignature(oldMember);
        const newSignature = this.getMethodSignature(newMember);
        if (oldSignature !== newSignature) {
          changes.push(
            this.createChange(
              'interface',
              `${newInterface.name.text}.${name}`,
              'major',
              `Changed signature of method '${name}' from '${oldSignature}' to '${newSignature}'`,
              oldMember,
              newMember
            )
          );
        }
      }

      // Check if optional status changed
      if (
        ts.isPropertySignature(oldMember) &&
        ts.isPropertySignature(newMember)
      ) {
        const wasOptional = oldMember.questionToken !== undefined;
        const isOptional = newMember.questionToken !== undefined;
        if (wasOptional !== isOptional) {
          changes.push(
            this.createChange(
              'interface',
              `${newInterface.name.text}.${name}`,
              wasOptional ? 'major' : 'minor',
              `Changed property '${name}' from ${
                wasOptional ? 'optional' : 'required'
              } to ${isOptional ? 'optional' : 'required'}`,
              oldMember,
              newMember
            )
          );
        }
      }
    }

    return changes;
  }

  private getMethodSignature(method: ts.MethodSignature): string {
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
}
