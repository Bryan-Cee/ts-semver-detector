import * as ts from "typescript";
import { BaseRule } from "./base-rule";
import { Change, Severity } from "../types";
import { TypeScriptParser } from "../parser/parser";

export class InterfaceRule extends BaseRule {
  constructor(parser: TypeScriptParser) {
    super(parser);
  }

  get id(): string {
    return "interface";
  }

  get description(): string {
    return "Analyzes changes in interface declarations";
  }

  public canHandle(oldNode: ts.Declaration, newNode: ts.Declaration): boolean {
    return (
      ts.isInterfaceDeclaration(oldNode) && ts.isInterfaceDeclaration(newNode)
    );
  }

  public analyze(oldNode: ts.Declaration, newNode: ts.Declaration): Change[] {
    if (!this.canHandle(oldNode, newNode)) {
      return [];
    }

    const oldInterface = oldNode as ts.InterfaceDeclaration;
    const newInterface = newNode as ts.InterfaceDeclaration;
    const name = this.getNodeName(newInterface);
    const changes: Change[] = [];

    try {
      // Check for heritage clauses (extends) changes
      this.analyzeHeritageChanges(oldInterface, newInterface, name, changes);

      // Check added/removed members
      const { added, removed, changed } = this.getChangedMembers(
        oldInterface,
        newInterface
      );

      // Removed members are breaking changes
      for (const member of removed) {
        changes.push({
          type: "interface",
          change: "memberRemoved",
          name: `${name}.${this.getMemberName(member)}`,
          severity: "major",
          description: `Removed member ${this.getMemberName(
            member
          )} from interface ${name}`,
        });
      }

      // Added members are non-breaking changes
      for (const member of added) {
        const isOptionalMember = this.isOptional(member);
        const isMethod = ts.isMethodSignature(member);

        // Methods are always considered minor changes when added
        const severity = isMethod
          ? "minor"
          : isOptionalMember
          ? "minor"
          : "major";
        const memberType = isMethod ? "method" : "member";

        changes.push({
          type: "interface",
          change: "memberAdded",
          name: `${name}.${this.getMemberName(member)}`,
          severity: severity,
          description: `Added ${
            isOptionalMember ? "optional" : ""
          } ${memberType} ${this.getMemberName(member)} to interface ${name}`,
        });
      }

      // Changed members need further analysis
      for (const { oldMember, newMember } of changed) {
        const memberName = this.getMemberName(newMember);
        const memberChanges = this.hasMemberChanged(oldMember, newMember);

        if (memberChanges.hasChanged) {
          changes.push({
            type: "interface",
            change: "memberChanged",
            name: `${name}.${memberName}`,
            severity: memberChanges.severity,
            description: `${memberChanges.description} ${memberName} in interface ${name}`,
            details: memberChanges.details,
          });
        }
      }

      return changes;
    } catch (error) {
      console.error(`Error analyzing interface ${name}:`, error);
      return [];
    }
  }

  private analyzeHeritageChanges(
    oldInterface: ts.InterfaceDeclaration,
    newInterface: ts.InterfaceDeclaration,
    name: string,
    changes: Change[]
  ): void {
    try {
      const {
        added: addedExtends,
        removed: removedExtends,
        changed: changedExtends,
      } = this.getChangedHeritageClause(oldInterface, newInterface);

      // Removed extends are breaking changes
      for (const extend of removedExtends) {
        changes.push({
          type: "interface",
          change: "extendsRemoved",
          name: `${name} extends ${extend.text}`,
          severity: "major",
          description: `Removed extends ${extend.text} from interface ${name}`,
        });
      }

      // Added extends are non-breaking changes
      for (const extend of addedExtends) {
        changes.push({
          type: "interface",
          change: "extendsAdded",
          name: `${name} extends ${extend.text}`,
          severity: "minor",
          description: `Added extends ${extend.text} to interface ${name}`,
        });
      }

      // Changed extends types could be breaking or non-breaking
      for (const { oldText, newText } of changedExtends) {
        changes.push({
          type: "interface",
          change: "extendsChanged",
          name: `${name}`,
          severity: "major",
          description: `Changed extends from '${oldText}' to '${newText}' in interface ${name}`,
        });
      }
    } catch (error) {
      console.error(
        `Error analyzing heritage changes for interface ${name}:`,
        error
      );
    }
  }

  private hasMemberChanged(
    oldMember: ts.TypeElement,
    newMember: ts.TypeElement
  ): {
    hasChanged: boolean;
    severity: Severity;
    description: string;
    details?: Record<string, unknown>;
  } {
    try {
      // Check if optional status changed
      const wasOptional = this.isOptional(oldMember);
      const isOptional = this.isOptional(newMember);

      if (wasOptional && !isOptional) {
        return {
          hasChanged: true,
          severity: "major",
          description: "Changed member from optional to required:",
          details: {
            optionalChanged: true,
            oldOptional: true,
            newOptional: false,
          },
        };
      } else if (!wasOptional && isOptional) {
        return {
          hasChanged: true,
          severity: "minor",
          description: "Changed member from required to optional:",
          details: {
            optionalChanged: true,
            oldOptional: false,
            newOptional: true,
          },
        };
      }

      // Check if type changed for property signatures
      if (
        ts.isPropertySignature(oldMember) &&
        ts.isPropertySignature(newMember)
      ) {
        if (oldMember.type && newMember.type) {
          try {
            const oldTypeText = this.parser.getNodeText(oldMember.type);
            const newTypeText = this.parser.getNodeText(newMember.type);

            if (oldTypeText !== newTypeText) {
              return {
                hasChanged: true,
                severity: "major",
                description: "Changed property type:",
                details: {
                  typeChanged: true,
                  oldType: oldTypeText,
                  newType: newTypeText,
                },
              };
            }
          } catch (error) {
            console.error("Error comparing property types:", error);
            // If we can't reliably compare, be conservative
            return {
              hasChanged: true,
              severity: "major",
              description: "Unable to properly compare property types:",
              details: {
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        } else if (oldMember.type && !newMember.type) {
          return {
            hasChanged: true,
            severity: "major",
            description: "Removed type from property:",
            details: {
              typeRemoved: true,
            },
          };
        } else if (!oldMember.type && newMember.type) {
          return {
            hasChanged: true,
            severity: "major",
            description: "Added type to property:",
            details: {
              typeAdded: true,
            },
          };
        }
      }

      // Check if method signature changed
      if (ts.isMethodSignature(oldMember) && ts.isMethodSignature(newMember)) {
        // Check for parameter changes
        if (this.hasParametersChanged(oldMember, newMember)) {
          return {
            hasChanged: true,
            severity: "major",
            description: "Changed method parameters:",
            details: {
              parametersChanged: true,
              oldParameters: this.getParametersText(oldMember),
              newParameters: this.getParametersText(newMember),
            },
          };
        }

        // Check for return type changes
        const returnTypeChange = this.checkReturnTypeChange(
          oldMember,
          newMember
        );
        if (returnTypeChange.hasChanged) {
          return {
            hasChanged: true,
            severity: returnTypeChange.severity,
            description: returnTypeChange.description,
            details: returnTypeChange.details,
          };
        }
      }

      return {
        hasChanged: false,
        severity: "none",
        description: "No changes detected",
      };
    } catch (error) {
      console.error("Error comparing members:", error);
      return {
        hasChanged: true,
        severity: "major",
        description: "Unable to properly compare members due to error:",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  // Helper methods for type change analysis

  private isNonBreakingTypeChange(oldType: string, newType: string): boolean {
    // Any -> unknown is non-breaking (more precise)
    if (oldType === "any" && newType === "unknown") {
      return true;
    }

    return false;
  }

  private getElementText(element: ts.TypeElement): string {
    try {
      // Use the parser's robust method to get text
      return this.parser.getNodeText(element);
    } catch (error) {
      console.error("Error getting element text:", error);
      // Fallback to simple name if possible
      if (ts.isPropertySignature(element) || ts.isMethodSignature(element)) {
        if (ts.isIdentifier(element.name)) {
          return element.name.escapedText.toString();
        }
      }
      return "unknown";
    }
  }

  private checkReturnTypeChange(
    oldMethod: ts.MethodSignature,
    newMethod: ts.MethodSignature
  ): {
    hasChanged: boolean;
    severity: Severity;
    description: string;
    details?: Record<string, unknown>;
  } {
    // If either doesn't have a return type, check if they're both missing it
    if (!oldMethod.type || !newMethod.type) {
      if (!!oldMethod.type !== !!newMethod.type) {
        return {
          hasChanged: true,
          severity: "major",
          description: oldMethod.type
            ? "Removed return type:"
            : "Added return type:",
          details: {
            returnTypeChanged: true,
            oldReturnType: oldMethod.type
              ? this.getReturnTypeText(oldMethod)
              : "implicit any",
            newReturnType: newMethod.type
              ? this.getReturnTypeText(newMethod)
              : "implicit any",
          },
        };
      }
      return {
        hasChanged: false,
        severity: "none",
        description: "No return type changes",
      };
    }

    const oldReturnType = this.getReturnTypeText(oldMethod);
    const newReturnType = this.getReturnTypeText(newMethod);

    if (oldReturnType !== newReturnType) {
      return {
        hasChanged: true,
        severity: "major",
        description: "Changed method return type:",
        details: {
          returnTypeChanged: true,
          oldReturnType,
          newReturnType,
        },
      };
    }

    return {
      hasChanged: false,
      severity: "none",
      description: "No return type changes",
    };
  }

  private getChangedMembers(
    oldInterface: ts.InterfaceDeclaration,
    newInterface: ts.InterfaceDeclaration
  ) {
    const oldMembers = oldInterface.members;
    const newMembers = newInterface.members;
    const oldMemberMap = new Map<string, ts.TypeElement>();
    const newMemberMap = new Map<string, ts.TypeElement>();

    // Index members by name
    for (const member of oldMembers) {
      const name = this.getMemberName(member);
      if (name) {
        oldMemberMap.set(name, member);
      }
    }

    for (const member of newMembers) {
      const name = this.getMemberName(member);
      if (name) {
        newMemberMap.set(name, member);
      }
    }

    // Find added, removed, and changed members
    const added: ts.TypeElement[] = [];
    const removed: ts.TypeElement[] = [];
    const changed: Array<{
      oldMember: ts.TypeElement;
      newMember: ts.TypeElement;
    }> = [];

    // Find added members
    for (const [name, member] of newMemberMap.entries()) {
      if (!oldMemberMap.has(name)) {
        added.push(member);
      }
    }

    // Find removed members
    for (const [name, member] of oldMemberMap.entries()) {
      if (!newMemberMap.has(name)) {
        removed.push(member);
      }
    }

    // Find changed members
    for (const [name, newMember] of newMemberMap.entries()) {
      const oldMember = oldMemberMap.get(name);
      if (oldMember) {
        changed.push({ oldMember, newMember });
      }
    }

    return { added, removed, changed };
  }

  private getChangedHeritageClause(
    oldInterface: ts.InterfaceDeclaration,
    newInterface: ts.InterfaceDeclaration
  ) {
    const oldExtends = this.getExtendedInterfacesWithText(oldInterface);
    const newExtends = this.getExtendedInterfacesWithText(newInterface);

    // Find added and removed extends by reference name
    const oldNames = oldExtends.map((e) => e.name);
    const newNames = newExtends.map((e) => e.name);

    const added = newExtends.filter((ext) => !oldNames.includes(ext.name));
    const removed = oldExtends.filter((ext) => !newNames.includes(ext.name));

    // Find changes in extends that have the same name but different type parameters
    const changed: Array<{ oldText: string; newText: string }> = [];

    for (const oldExt of oldExtends) {
      for (const newExt of newExtends) {
        if (oldExt.name === newExt.name && oldExt.text !== newExt.text) {
          changed.push({ oldText: oldExt.text, newText: newExt.text });
        }
      }
    }

    return { added, removed, changed };
  }

  private getExtendedInterfacesWithText(
    node: ts.InterfaceDeclaration
  ): Array<{ name: string; text: string }> {
    try {
      if (!node.heritageClauses) return [];

      const extendsClause = node.heritageClauses.find(
        (h) => h.token === ts.SyntaxKind.ExtendsKeyword
      );

      if (!extendsClause) return [];

      return extendsClause.types.map((t) => {
        try {
          // Extract the base name without type parameters
          const fullText = this.parser.getNodeText(t);
          let name = fullText;

          // Get base name (without type parameters)
          const typeParamsStart = fullText.indexOf("<");
          if (typeParamsStart > 0) {
            name = fullText.substring(0, typeParamsStart).trim();
          }

          return { name, text: fullText };
        } catch (error) {
          console.error("Error getting extended interface text:", error);
          // Return a placeholder name to avoid breaking the analysis
          return { name: "unknown", text: "unknown" };
        }
      });
    } catch (error) {
      console.error("Error getting extended interfaces:", error);
      return [];
    }
  }

  private getMemberName(member: ts.TypeElement): string {
    try {
      if (ts.isPropertySignature(member) || ts.isMethodSignature(member)) {
        if (ts.isIdentifier(member.name)) {
          return member.name.text;
        } else if (ts.isStringLiteral(member.name)) {
          return member.name.text;
        } else if (ts.isNumericLiteral(member.name)) {
          return member.name.text;
        } else if (ts.isComputedPropertyName(member.name)) {
          return this.parser.getNodeText(member.name);
        }
      } else if (ts.isIndexSignatureDeclaration(member)) {
        return "index";
      } else if (ts.isCallSignatureDeclaration(member)) {
        return "call";
      } else if (ts.isConstructSignatureDeclaration(member)) {
        return "constructor";
      }

      // Default fallback
      return "unknown";
    } catch (e) {
      console.error(`Error getting member name: ${e}`);
      return "unknown";
    }
  }

  private isOptional(member: ts.TypeElement): boolean {
    return !!member.questionToken;
  }

  private hasParametersChanged(
    oldMethod: ts.MethodSignature,
    newMethod: ts.MethodSignature
  ): boolean {
    try {
      const oldParams = oldMethod.parameters || [];
      const newParams = newMethod.parameters || [];

      // Check parameter count
      if (oldParams.length !== newParams.length) {
        return true;
      }

      // Check each parameter
      for (let i = 0; i < oldParams.length; i++) {
        const oldParam = oldParams[i];
        const newParam = newParams[i];

        try {
          // Check parameter name
          const oldParamName = this.parser.getNodeText(oldParam.name);
          const newParamName = this.parser.getNodeText(newParam.name);

          if (oldParamName !== newParamName) {
            return true;
          }

          // Check parameter type
          if (
            (oldParam.type && !newParam.type) ||
            (!oldParam.type && newParam.type)
          ) {
            return true;
          }

          if (oldParam.type && newParam.type) {
            const oldTypeText = this.parser.getNodeText(oldParam.type);
            const newTypeText = this.parser.getNodeText(newParam.type);

            if (oldTypeText !== newTypeText) {
              // Special case for non-breaking type changes
              if (this.isNonBreakingTypeChange(oldTypeText, newTypeText)) {
                continue; // This is a non-breaking change
              }

              return true;
            }
          }
        } catch (error) {
          console.error("Error comparing parameter:", error);
          // If we can't reliably compare, assume they're different to be safe
          return true;
        }

        // Check if optional status changed
        if (!!oldParam.questionToken !== !!newParam.questionToken) {
          return true;
        }

        // Check if dot dot dot token changed
        if (!!oldParam.dotDotDotToken !== !!newParam.dotDotDotToken) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Error comparing parameters:", error);
      // If we can't reliably compare, assume they're different to be safe
      return true;
    }
  }

  private getParametersText(method: ts.MethodSignature): string {
    try {
      return method.parameters
        .map((p) => {
          try {
            return this.parser.getNodeText(p);
          } catch (error) {
            console.error("Error getting parameter text:", error);
            return "unknown";
          }
        })
        .join(", ");
    } catch (error) {
      console.error("Error getting parameters text:", error);
      return "unknown";
    }
  }

  private getReturnTypeText(method: ts.MethodSignature): string {
    try {
      return method.type ? this.parser.getNodeText(method.type) : "any";
    } catch (error) {
      console.error("Error getting return type text:", error);
      return "unknown";
    }
  }

  protected getNodeName(node: ts.Node): string {
    if (ts.isInterfaceDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name.text;
    }
    return "unknown";
  }
}
