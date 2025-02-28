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
    
    try {
      // Cast to interface declarations
      const oldInterface = oldNode as ts.InterfaceDeclaration;
      const newInterface = newNode as ts.InterfaceDeclaration;
      
      // Get interface name
      let interfaceName = 'unknown';
      try {
        interfaceName = oldInterface.name?.getText() || 'unknown';
      } catch (e) {
        console.error(`Error getting interface name: ${e}`);
      }
      
      // Group members by name for easier comparison
      const oldMembers = new Map<string, ts.TypeElement>();
      const newMembers = new Map<string, ts.TypeElement>();
      
      try {
        // Group old members
        oldInterface.members.forEach(member => {
          try {
            if (member.name) {
              let memberName = '';
              try {
                memberName = member.name.getText();
              } catch (e) {
                console.error(`Error getting member name: ${e}`);
                return; // Skip this member
              }
              
              if (memberName) {
                oldMembers.set(memberName, member);
              }
            }
          } catch (e) {
            console.error(`Error processing old interface member: ${e}`);
          }
        });
        
        // Group new members
        newInterface.members.forEach(member => {
          try {
            if (member.name) {
              let memberName = '';
              try {
                memberName = member.name.getText();
              } catch (e) {
                console.error(`Error getting member name: ${e}`);
                return; // Skip this member
              }
              
              if (memberName) {
                newMembers.set(memberName, member);
              }
            }
          } catch (e) {
            console.error(`Error processing new interface member: ${e}`);
          }
        });
      } catch (e) {
        console.error(`Error grouping interface members: ${e}`);
      }
      
      // Check for removed members
      for (const [name, oldMember] of oldMembers) {
        if (!newMembers.has(name)) {
          changes.push(
            this.createChange(
              'interface',
              `${interfaceName}.${name}`,
              'major',
              `Removed member '${name}'`,
              oldMember
            )
          );
        }
      }
      
      // Check for added and modified members
      for (const [name, newMember] of newMembers) {
        try {
          const oldMember = oldMembers.get(name);
          if (!oldMember) {
            // Added member
            let isOptional = false;
            try {
              isOptional = ts.isPropertySignature(newMember) && !!newMember.questionToken;
            } catch (e) {
              console.error(`Error checking if member is optional: ${e}`);
            }
            
            let isMethod = false;
            try {
              isMethod = ts.isMethodSignature(newMember);
            } catch (e) {
              console.error(`Error checking if member is a method: ${e}`);
            }
            
            changes.push(
              this.createChange(
                'interface',
                `${interfaceName}.${name}`,
                isOptional ? 'minor' : 'major',
                `Added ${isOptional ? 'optional' : 'required'} ${
                  isMethod ? 'method' : 'property'
                } '${name}'`,
                newMember
              )
            );
          } else {
            // Modified member
            this.compareMemberTypes(oldMember, newMember, interfaceName, name, changes);
          }
        } catch (e) {
          console.error(`Error checking added/modified member '${name}': ${e}`);
        }
      }
      
      // Compare extends clauses
      try {
        const oldExtends = oldInterface.heritageClauses?.find(
          clause => clause.token === ts.SyntaxKind.ExtendsKeyword
        );
        const newExtends = newInterface.heritageClauses?.find(
          clause => clause.token === ts.SyntaxKind.ExtendsKeyword
        );
        
        if (oldExtends && !newExtends) {
          changes.push(
            this.createChange(
              'interface',
              interfaceName,
              'major',
              `Removed extends clause`,
              oldInterface,
              newInterface
            )
          );
        } else if (!oldExtends && newExtends) {
          changes.push(
            this.createChange(
              'interface',
              interfaceName,
              'major',
              `Added extends clause`,
              oldInterface,
              newInterface
            )
          );
        } else if (oldExtends && newExtends) {
          // Compare the extended types
          const oldTypes = oldExtends.types.map(t => {
            try {
              return t.getText();
            } catch (e) {
              console.error(`Error getting old extends type text: ${e}`);
              return '';
            }
          }).filter(Boolean);
          
          const newTypes = newExtends.types.map(t => {
            try {
              return t.getText();
            } catch (e) {
              console.error(`Error getting new extends type text: ${e}`);
              return '';
            }
          }).filter(Boolean);
          
          // Check for removed extends
          for (const oldType of oldTypes) {
            if (!newTypes.includes(oldType)) {
              changes.push(
                this.createChange(
                  'interface',
                  interfaceName,
                  'major',
                  `Removed extends type '${oldType}'`,
                  oldInterface,
                  newInterface
                )
              );
            }
          }
          
          // Check for added extends
          for (const newType of newTypes) {
            if (!oldTypes.includes(newType)) {
              changes.push(
                this.createChange(
                  'interface',
                  interfaceName,
                  'major',
                  `Added extends type '${newType}'`,
                  oldInterface,
                  newInterface
                )
              );
            }
          }
        }
      } catch (e) {
        console.error(`Error comparing extends clauses: ${e}`);
      }
    } catch (e) {
      console.error(`Error in InterfaceRule.analyze: ${e}`);
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

  private compareMemberTypes(oldMember: ts.TypeElement, newMember: ts.TypeElement, interfaceName: string, name: string, changes: Change[]): void {
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
            `${interfaceName}.${name}`,
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
            `${interfaceName}.${name}`,
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
            `${interfaceName}.${name}`,
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
}
