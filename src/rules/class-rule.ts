import * as ts from 'typescript';
import { BaseRule } from './base-rule';
import { Change } from '../types';
import { TypeScriptParser } from '../parser/parser';

export class ClassRule extends BaseRule {
  constructor(parser: TypeScriptParser) {
    super(parser);
  }

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

    try {
      // Check heritage changes
      const oldHeritage = this.getHeritageInfo(oldClass);
      const newHeritage = this.getHeritageInfo(newClass);

      // Check base class changes
      if (oldHeritage.baseClass !== newHeritage.baseClass) {
        changes.push(
          this.createChange(
            'class',
            newClass.name?.text || 'anonymous',
            'major',
            `Changed base class from '${oldHeritage.baseClass || 'none'}' to '${newHeritage.baseClass || 'none'}'`,
            oldClass,
            newClass
          )
        );
      }

      // Check interface changes
      const addedInterfaces = newHeritage.interfaces.filter(
        (i) => !oldHeritage.interfaces.includes(i)
      );
      const removedInterfaces = oldHeritage.interfaces.filter(
        (i) => !newHeritage.interfaces.includes(i)
      );

      for (const intf of addedInterfaces) {
        changes.push(
          this.createChange(
            'class',
            newClass.name?.text || 'anonymous',
            'minor',
            `Added implemented interface '${intf}'`,
            oldClass,
            newClass
          )
        );
      }

      for (const intf of removedInterfaces) {
        changes.push(
          this.createChange(
            'class',
            oldClass.name?.text || 'anonymous',
            'major',
            `Removed implemented interface '${intf}'`,
            oldClass,
            newClass
          )
        );
      }

      // Check member changes
      const oldMembers = this.getMemberMap(oldClass);
      const newMembers = this.getMemberMap(newClass);

      // Check for removed members
      for (const [name, oldMember] of oldMembers.entries()) {
        const isPublic = !this.isPrivate(oldMember);
        if (isPublic && !newMembers.has(name)) {
          changes.push(
            this.createChange(
              'class',
              `${oldClass.name?.text || 'anonymous'}.${name}`,
              'major',
              `Removed public member '${name}'`,
              oldMember,
              undefined
            )
          );
        }
      }

      // Check for added or changed members
      for (const [name, newMember] of newMembers.entries()) {
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
          try {
            let oldType = 'any';
            let newType = 'any';
            
            if (oldMember.type) {
              oldType = this.parser.getNodeText(oldMember.type);
            }
            
            if (newMember.type) {
              newType = this.parser.getNodeText(newMember.type);
            }

            if (oldType !== newType) {
              changes.push(
                this.createChange(
                  'class',
                  `${oldClass.name?.text || 'anonymous'}.${name}`,
                  'major',
                  `Changed type of property '${name}' from '${oldType}' to '${newType}'`,
                  oldMember,
                  newMember
                )
              );
            }
          } catch (e) {
            console.error(`Error comparing property types: ${e}`);
          }
        } else if (
          ts.isMethodDeclaration(oldMember) &&
          ts.isMethodDeclaration(newMember)
        ) {
          // Compare method signatures
          const oldSignature = this.getMethodSignature(oldMember as ts.MethodDeclaration);
          const newSignature = this.getMethodSignature(newMember as ts.MethodDeclaration);
          
          if (oldSignature !== newSignature) {
            changes.push(
              this.createChange(
                'class',
                `${oldClass.name?.text || 'anonymous'}.${name}`,
                'major',
                `Changed method signature with return type from '${oldSignature}' to '${newSignature}'`,
                oldMember,
                newMember
              )
            );
          }
        }
      }
    } catch (e) {
      console.error(`Error analyzing class: ${e}`);
    }

    return changes;
  }

  private getHeritageInfo(node: ts.ClassDeclaration) {
    let baseClass: string | undefined;
    const interfaces: string[] = [];

    try {
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          if (
            clause.token === ts.SyntaxKind.ExtendsKeyword &&
            clause.types.length > 0
          ) {
            try {
              baseClass = this.parser.getNodeText(clause.types[0]);
            } catch (e) {
              console.error(`Error getting base class text: ${e}`);
            }
          } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
            for (const t of clause.types) {
              try {
                interfaces.push(this.parser.getNodeText(t));
              } catch (e) {
                console.error(`Error getting interface text: ${e}`);
              }
            }
          }
        }
      }

      return { baseClass, interfaces };
    } catch (e) {
      console.error(`Error in getHeritageInfo: ${e}`);
      return { baseClass: undefined, interfaces: [] };
    }
  }

  private getMemberMap(
    node: ts.ClassDeclaration
  ): Map<string, ts.ClassElement> {
    const members = new Map<string, ts.ClassElement>();

    try {
      for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) || ts.isMethodDeclaration(member)) {
          try {
            let name: string;
            if (member.name) {
              name = this.parser.getNodeText(member.name);
            } else {
              name = 'unknown';
              continue; // Skip members without a name
            }
            members.set(name, member);
          } catch (e) {
            console.error(`Error getting member name: ${e}`);
          }
        }
      }

      return members;
    } catch (e) {
      console.error(`Error in getMemberMap: ${e}`);
      return members;
    }
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
    if (!method) {
      return 'unknown';
    }

    try {
      // Get parameter string
      const params = method.parameters
        .map((p) => {
          try {
            const paramName = this.parser.getNodeText(p.name);
            const paramType = p.type ? this.parser.getNodeText(p.type) : 'any';
            const isOptional = p.questionToken ? '?' : '';
            return `${paramName}${isOptional}: ${paramType}`;
          } catch (e) {
            return 'unknown';
          }
        })
        .join(', ');

      // Get return type
      let returnType = 'void';
      if (method.type) {
        try {
          returnType = this.parser.getNodeText(method.type);
        } catch (e) {
          // Use default
        }
      }

      return `(${params}) => ${returnType}`;
    } catch (error) {
      console.error('Error getting method signature:', error);
      return 'unknown';
    }
  }

  private compareMethodSignatures(
    oldMethod: ts.MethodDeclaration,
    newMethod: ts.MethodDeclaration
  ): Change[] {
    const changes: Change[] = [];
    
    try {
      let methodName: string;
      try {
        methodName = this.parser.getNodeText(oldMethod.name);
      } catch (e) {
        console.error(`Error getting method name: ${e}`);
        methodName = 'unknown';
      }
      
      // Check return type
      if (oldMethod.type && newMethod.type) {
        try {
          const oldReturnType = this.parser.getNodeText(oldMethod.type);
          const newReturnType = this.parser.getNodeText(newMethod.type);
          
          if (oldReturnType !== newReturnType) {
            changes.push(
              this.createChange(
                'class',
                methodName,
                'major',
                `Changed method return type from '${oldReturnType}' to '${newReturnType}'`,
                oldMethod,
                newMethod
              )
            );
            return changes; // Return early since we already found a major change
          }
        } catch (e) {
          console.error(`Error comparing return types: ${e}`);
        }
      }
      
      // If we didn't find a return type change, check for other signature changes
      const oldSig = this.getMethodSignature(oldMethod);
      const newSig = this.getMethodSignature(newMethod);
      
      if (oldSig !== newSig) {
        changes.push(
          this.createChange(
            'class',
            methodName,
            'major',
            `Changed method signature with return type from '${oldSig}' to '${newSig}'`,
            oldMethod,
            newMethod
          )
        );
      }
      
      // Compare parameters
      const oldParams = oldMethod.parameters;
      const newParams = newMethod.parameters;
      
      // Check for removed parameters
      for (const oldParam of oldParams) {
        try {
          let paramName: string;
          try {
            paramName = this.parser.getNodeText(oldParam.name);
          } catch (e) {
            console.error(`Error getting parameter name: ${e}`);
            continue;
          }
          
          const newParam = newParams.find((p) => {
            try {
              return this.parser.getNodeText(p.name) === paramName;
            } catch (e) {
              return false;
            }
          });
          
          if (!newParam) {
            changes.push(
              this.createChange(
                'class',
                `${methodName}.${paramName}`,
                'major',
                `Removed parameter '${paramName}' from method '${methodName}'`,
                oldParam,
                undefined
              )
            );
          }
        } catch (e) {
          console.error(`Error checking removed parameters: ${e}`);
        }
      }
      
      // Check for added parameters
      for (const newParam of newParams) {
        try {
          let paramName: string;
          try {
            paramName = this.parser.getNodeText(newParam.name);
          } catch (e) {
            console.error(`Error getting parameter name: ${e}`);
            continue;
          }
          
          const oldParam = oldParams.find((p) => {
            try {
              return this.parser.getNodeText(p.name) === paramName;
            } catch (e) {
              return false;
            }
          });
          
          if (!oldParam) {
            changes.push(
              this.createChange(
                'class',
                `${methodName}.${paramName}`,
                newParam.questionToken ? 'minor' : 'major',
                `Added ${
                  newParam.questionToken ? 'optional' : 'required'
                } parameter '${paramName}' to method '${methodName}'`,
                undefined,
                newParam
              )
            );
          }
        } catch (e) {
          console.error(`Error checking added parameters: ${e}`);
        }
      }
      
      // Compare parameter types
      for (const newParam of newParams) {
        try {
          let paramName: string;
          try {
            paramName = this.parser.getNodeText(newParam.name);
          } catch (e) {
            console.error(`Error getting parameter name: ${e}`);
            continue;
          }
          
          const oldParam = oldParams.find((p) => {
            try {
              return this.parser.getNodeText(p.name) === paramName;
            } catch (e) {
              return false;
            }
          });
          
          if (oldParam && oldParam.type && newParam.type) {
            try {
              const oldType = this.parser.getNodeText(oldParam.type);
              const newType = this.parser.getNodeText(newParam.type);
              
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
            } catch (e) {
              console.error(`Error comparing parameter types: ${e}`);
            }
          }
        } catch (e) {
          console.error(`Error checking parameter type changes: ${e}`);
        }
      }
    } catch (e) {
      console.error(`Error in compareMethodSignatures: ${e}`);
    }
    
    return changes;
  }
}
