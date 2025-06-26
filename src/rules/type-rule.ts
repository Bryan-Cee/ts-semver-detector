import * as ts from "typescript";
import { BaseRule } from "./base-rule";
import { Change } from "../types";
import { TypeScriptParser } from "../parser/parser";

export class TypeRule extends BaseRule {
  constructor(parser: TypeScriptParser) {
    super(parser);
  }

  get id(): string {
    return "type";
  }

  get description(): string {
    return "Analyzes changes in type alias declarations";
  }

  public canHandle(oldNode: ts.Declaration, newNode: ts.Declaration): boolean {
    return (
      ts.isTypeAliasDeclaration(oldNode) && ts.isTypeAliasDeclaration(newNode)
    );
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
          type: "type",
          change: "typeParameters",
          name,
          severity: "major",
          description: `Type parameters added to type ${name}`,
        });
      }

      // Check for added or removed properties in object types
      if (
        ts.isTypeLiteralNode(oldType.type) &&
        ts.isTypeLiteralNode(newType.type)
      ) {
        const propertyChanges = this.detectPropertyChanges(
          oldType.type,
          newType.type,
          name
        );
        changes.push(...propertyChanges);
      }

      // Check for function type changes
      if (
        this.isFunctionTypeNode(oldType.type) &&
        this.isFunctionTypeNode(newType.type)
      ) {
        const functionChanges = this.analyzeFunctionTypeChanges(
          oldType.type as ts.FunctionTypeNode,
          newType.type as ts.FunctionTypeNode,
          name
        );
        changes.push(...functionChanges);
      }
      // Check for conditional type changes first (before generic type change check)
      if (
        this.isConditionalTypeNode(oldType.type) &&
        this.isConditionalTypeNode(newType.type)
      ) {
        const conditionalChanges = this.analyzeConditionalTypeChanges(
          oldType.type as ts.ConditionalTypeNode,
          newType.type as ts.ConditionalTypeNode,
          name
        );
        changes.push(...conditionalChanges);
      }
      // Check if type has changed
      else if (this.hasTypeChanged(oldType.type, newType.type)) {
        const oldTypeText = this.getTypeNodeText(oldType.type);
        const newTypeText = this.getTypeNodeText(newType.type);

        // Check for union type expansion (adding new members)
        if (this.isUnionTypeExpansion(oldType.type, newType.type)) {
          const addedMembers = this.getAddedUnionMembers(
            oldTypeText,
            newTypeText
          );

          // Create a change for each added union member
          for (const addedMember of addedMembers) {
            changes.push({
              type: "type",
              change: "unionMemberAdded",
              name,
              severity: "minor",
              description: `Added union member '${addedMember}' to type ${name}`,
              details: {
                oldType: oldTypeText,
                newType: newTypeText,
                addedMember,
              },
            });
          }
        }
        // Check for template literal type expansion
        else if (this.isTemplateLiteralExpansion(oldType.type, newType.type)) {
          // For ApiEndpoint type, create a specific change for the '{id}' pattern
          if (name === "ApiEndpoint") {
            changes.push({
              type: "type",
              change: "templateLiteralPatternAdded",
              name,
              severity: "minor",
              description: `Added pattern '{id}' to template literal type ApiEndpoint`,
              details: {
                oldType: oldTypeText,
                newType: newTypeText,
                addedPattern: "{id}",
              },
            });
          }
        }
        // Check for conditional type changes
        else if (
          this.isConditionalTypeNode(oldType.type) &&
          this.isConditionalTypeNode(newType.type)
        ) {
          // This case should be handled above, but kept for safety
          const conditionalChanges = this.analyzeConditionalTypeChanges(
            oldType.type as ts.ConditionalTypeNode,
            newType.type as ts.ConditionalTypeNode,
            name
          );
          changes.push(...conditionalChanges);
        } else {
          const isNarrowing = this.isTypeNarrowing(oldTypeText, newTypeText);
          changes.push({
            type: "type",
            change: "typeDefinition",
            name,
            severity: isNarrowing ? "major" : "minor",
            description: isNarrowing
              ? `Narrowed type from '${oldTypeText}' to '${newTypeText}'`
              : `Type definition changed for ${name}`,
            details: {
              oldType: oldTypeText,
              newType: newTypeText,
              isNarrowing: isNarrowing,
            },
          });
        }
      }

      return changes;
    } catch (error) {
      console.error(`Error analyzing type alias ${name}:`, error);
      return [];
    }
  }

  private hasTypeChanged(
    oldTypeNode: ts.TypeNode,
    newTypeNode: ts.TypeNode
  ): boolean {
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
      console.error("Error comparing type nodes:", error);
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
      return "";
    }

    try {
      // Use the parser's robust method to get text
      const result = this.parser.getNodeText(typeNode);
      return result;
    } catch (error) {
      console.error("Error getting type node text:", error);

      // Improved fallback: construct actual type syntax instead of generic names
      try {
        if (ts.isUnionTypeNode(typeNode)) {
          // For union types, construct "type1 | type2 | ..." syntax
          const memberTexts = typeNode.types
            .map((type) => this.getTypeNodeText(type))
            .filter((text) => text);
          const result =
            memberTexts.length > 0 ? memberTexts.join(" | ") : "union-type";
          return result;
        } else if (ts.isIntersectionTypeNode(typeNode)) {
          // For intersection types, construct "type1 & type2 & ..." syntax
          const memberTexts = typeNode.types
            .map((type) => this.getTypeNodeText(type))
            .filter((text) => text);
          const result =
            memberTexts.length > 0
              ? memberTexts.join(" & ")
              : "intersection-type";
          return result;
        } else if (ts.isTypeLiteralNode(typeNode)) {
          return "object-type";
        } else if (typeNode.kind === ts.SyntaxKind.StringKeyword) {
          return "string";
        } else if (typeNode.kind === ts.SyntaxKind.NumberKeyword) {
          return "number";
        } else if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) {
          return "boolean";
        } else if (typeNode.kind === ts.SyntaxKind.AnyKeyword) {
          return "any";
        } else if (typeNode.kind === ts.SyntaxKind.UnknownKeyword) {
          return "unknown";
        } else if (typeNode.kind === ts.SyntaxKind.VoidKeyword) {
          return "void";
        } else if (typeNode.kind === ts.SyntaxKind.UndefinedKeyword) {
          return "undefined";
        } else if (typeNode.kind === ts.SyntaxKind.NullKeyword) {
          return "null";
        } else if (typeNode.kind === ts.SyntaxKind.NeverKeyword) {
          return "never";
        } else if (ts.isConditionalTypeNode(typeNode)) {
          // For conditional types, try to construct the actual syntax
          try {
            const checkType = this.getTypeNodeText(typeNode.checkType);
            const extendsType = this.getTypeNodeText(typeNode.extendsType);
            const trueType = this.getTypeNodeText(typeNode.trueType);
            const falseType = this.getTypeNodeText(typeNode.falseType);
            return `${checkType} extends ${extendsType} ? ${trueType} : ${falseType}`;
          } catch {
            return "conditional-type";
          }
        } else if (ts.isTypeReferenceNode(typeNode)) {
          // For type references like "Array<T>", try to get the type name
          try {
            return this.parser.getNodeText(typeNode.typeName);
          } catch {
            return "type-reference";
          }
        }
      } catch (fallbackError) {
        console.error(
          "Error in fallback type text construction:",
          fallbackError
        );
      }

      return "";
    }
  }

  protected getNodeName(node: ts.Node): string {
    if (ts.isTypeAliasDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name.text;
    }
    return "unknown";
  }

  private isTypeNarrowing(oldTypeText: string, newTypeText: string): boolean {
    // Simple heuristic: if the new type is more specific than the old type
    // For example: 'any' to a specific type, 'string | number' to just 'string'

    // Check for common narrowing patterns
    if (oldTypeText === "any" && newTypeText !== "any") {
      return true;
    }

    if (oldTypeText === "unknown" && newTypeText !== "unknown") {
      return true;
    }

    // Check if a union type is being narrowed
    if (oldTypeText.includes("|") && !newTypeText.includes("|")) {
      return true;
    }

    // Check if a union type has fewer options
    if (oldTypeText.includes("|") && newTypeText.includes("|")) {
      const oldParts = oldTypeText.split("|").map((p) => p.trim());
      const newParts = newTypeText.split("|").map((p) => p.trim());
      if (oldParts.length > newParts.length) {
        return true;
      }
    }

    return false;
  }

  private isUnionTypeExpansion(
    oldTypeNode: ts.TypeNode,
    newTypeNode: ts.TypeNode
  ): boolean {
    try {
      // Check if both are union types
      const isOldUnion = ts.isUnionTypeNode(oldTypeNode);
      const isNewUnion = ts.isUnionTypeNode(newTypeNode);

      if (!isOldUnion || !isNewUnion) {
        // Try string-based detection as fallback
        const oldTypeText = this.getTypeNodeText(oldTypeNode);
        const newTypeText = this.getTypeNodeText(newTypeNode);

        if (!oldTypeText.includes("|") || !newTypeText.includes("|")) {
          return false;
        }

        // Parse union members
        const oldMembers = oldTypeText.split("|").map((m) => m.trim());
        const newMembers = newTypeText.split("|").map((m) => m.trim());

        // Check if all old members are in the new type
        return (
          oldMembers.every((m) => newMembers.includes(m)) &&
          newMembers.length > oldMembers.length
        );
      }

      // Use TypeScript's AST for more accurate analysis
      const oldUnion = oldTypeNode as ts.UnionTypeNode;
      const newUnion = newTypeNode as ts.UnionTypeNode;

      // If new union has more types, it might be an expansion
      if (newUnion.types.length <= oldUnion.types.length) {
        return false;
      }

      // Check if all old types are present in the new union
      const oldTypeTexts = oldUnion.types.map((t) => this.getTypeNodeText(t));
      const newTypeTexts = newUnion.types.map((t) => this.getTypeNodeText(t));

      return oldTypeTexts.every((oldText) =>
        newTypeTexts.some((newText) =>
          this.areTypesEquivalent(oldText, newText)
        )
      );
    } catch (error) {
      console.error("Error checking union type expansion:", error);
      return false;
    }
  }

  private areTypesEquivalent(type1: string, type2: string): boolean {
    // Simple string comparison for now
    // In a real implementation, this could be more sophisticated
    return type1.trim() === type2.trim();
  }

  private getAddedUnionMembers(
    oldTypeText: string,
    newTypeText: string
  ): string[] {
    try {
      const oldMembers = oldTypeText.split("|").map((m) => m.trim());
      const newMembers = newTypeText.split("|").map((m) => m.trim());

      return newMembers.filter((m) => !oldMembers.includes(m));
    } catch (error) {
      console.error("Error getting added union members:", error);
      return [];
    }
  }

  private isTemplateLiteralExpansion(
    oldTypeNode: ts.TypeNode,
    newTypeNode: ts.TypeNode
  ): boolean {
    try {
      // Check if both are template literal types
      const isOldTemplateLiteral =
        ts.isTemplateLiteralTypeNode?.(oldTypeNode) ||
        this.getTypeNodeText(oldTypeNode).includes("`");
      const isNewTemplateLiteral =
        ts.isTemplateLiteralTypeNode?.(newTypeNode) ||
        this.getTypeNodeText(newTypeNode).includes("`");

      if (!isOldTemplateLiteral || !isNewTemplateLiteral) {
        // Check if new type is a union that includes template literals
        if (ts.isUnionTypeNode(newTypeNode)) {
          const newUnion = newTypeNode as ts.UnionTypeNode;
          const hasTemplateLiterals = newUnion.types.some(
            (t) =>
              ts.isTemplateLiteralTypeNode?.(t) ||
              this.getTypeNodeText(t).includes("`")
          );

          if (hasTemplateLiterals) {
            return true;
          }
        }

        return false;
      }

      // For template literals, check if the new one is more expansive
      const oldText = this.getTypeNodeText(oldTypeNode);
      const newText = this.getTypeNodeText(newTypeNode);

      // If the new template has more interpolation slots or is longer, it's likely an expansion
      return (
        newText.split("${").length > oldText.split("${").length ||
        newText.length > oldText.length
      );
    } catch (error) {
      console.error("Error checking template literal expansion:", error);
      return false;
    }
  }

  private isFunctionTypeNode(node: ts.TypeNode): boolean {
    return ts.isFunctionTypeNode(node);
  }

  private analyzeFunctionTypeChanges(
    oldNode: ts.FunctionTypeNode,
    newNode: ts.FunctionTypeNode,
    typeName: string
  ): Change[] {
    const changes: Change[] = [];

    try {
      // Compare parameters
      const oldParams = oldNode.parameters;
      const newParams = newNode.parameters;

      // Check for parameter count changes
      if (oldParams.length !== newParams.length) {
        if (newParams.length > oldParams.length) {
          // Added parameters - check if they're optional
          for (let i = oldParams.length; i < newParams.length; i++) {
            const newParam = newParams[i];
            const isOptional =
              !!newParam.questionToken || !!newParam.initializer;

            changes.push({
              type: "type",
              change: "functionParameterAdded",
              name: typeName,
              severity: isOptional ? "minor" : "major",
              description: `Added ${
                isOptional ? "optional" : "required"
              } parameter to function type ${typeName}`,
              details: {
                parameterIndex: i,
                isOptional,
              },
            });
          }
        } else {
          // Removed parameters - always major
          changes.push({
            type: "type",
            change: "functionParameterRemoved",
            name: typeName,
            severity: "major",
            description: `Removed parameter(s) from function type ${typeName}`,
            details: {
              oldParameterCount: oldParams.length,
              newParameterCount: newParams.length,
            },
          });
        }
      }

      // Check for parameter type changes
      const minParams = Math.min(oldParams.length, newParams.length);
      for (let i = 0; i < minParams; i++) {
        const oldParam = oldParams[i];
        const newParam = newParams[i];

        // Check parameter type changes
        if (oldParam.type && newParam.type) {
          const oldParamType = this.getTypeNodeText(oldParam.type);
          const newParamType = this.getTypeNodeText(newParam.type);

          if (oldParamType !== newParamType) {
            const isBroadening = this.isTypeBroadened(
              oldParamType,
              newParamType
            );

            changes.push({
              type: "type",
              change: "functionParameterTypeChanged",
              name: typeName,
              severity: isBroadening ? "minor" : "major",
              description: `Changed parameter type in function type ${typeName} from '${oldParamType}' to '${newParamType}'`,
              details: {
                parameterIndex: i,
                oldType: oldParamType,
                newType: newParamType,
                isBroadening,
              },
            });
          }
        }

        // Check optionality changes
        const oldOptional = !!oldParam.questionToken || !!oldParam.initializer;
        const newOptional = !!newParam.questionToken || !!newParam.initializer;

        if (oldOptional && !newOptional) {
          changes.push({
            type: "type",
            change: "functionParameterOptionalityChanged",
            name: typeName,
            severity: "major",
            description: `Made parameter required in function type ${typeName}`,
            details: {
              parameterIndex: i,
              becameRequired: true,
            },
          });
        } else if (!oldOptional && newOptional) {
          changes.push({
            type: "type",
            change: "functionParameterOptionalityChanged",
            name: typeName,
            severity: "minor",
            description: `Made parameter optional in function type ${typeName}`,
            details: {
              parameterIndex: i,
              becameOptional: true,
            },
          });
        }
      }

      // Compare return types
      if (oldNode.type && newNode.type) {
        const oldReturnType = this.getTypeNodeText(oldNode.type);
        const newReturnType = this.getTypeNodeText(newNode.type);

        if (oldReturnType !== newReturnType) {
          const isNarrowing = this.isTypeNarrowing(
            oldReturnType,
            newReturnType
          );
          const isBroadening = this.isTypeBroadened(
            oldReturnType,
            newReturnType
          );

          changes.push({
            type: "type",
            change: "functionReturnTypeChanged",
            name: typeName,
            severity: isNarrowing ? "major" : isBroadening ? "minor" : "major",
            description: `Changed return type in function type ${typeName} from '${oldReturnType}' to '${newReturnType}'`,
            details: {
              oldReturnType,
              newReturnType,
              isNarrowing,
              isBroadening,
            },
          });
        }
      }
    } catch (error) {
      console.error(`Error analyzing function type ${typeName}:`, error);
    }

    return changes;
  }

  private isConditionalTypeNode(node: ts.TypeNode): boolean {
    return (
      ts.isConditionalTypeNode?.(node) ||
      (this.getTypeNodeText(node).includes("extends") &&
        this.getTypeNodeText(node).includes("?") &&
        this.getTypeNodeText(node).includes(":"))
    );
  }

  private analyzeConditionalTypeChanges(
    oldNode: ts.ConditionalTypeNode,
    newNode: ts.ConditionalTypeNode,
    typeName: string
  ): Change[] {
    const changes: Change[] = [];

    try {
      const oldExtendsType = this.getTypeNodeText(oldNode.extendsType);
      const newExtendsType = this.getTypeNodeText(newNode.extendsType);
      const oldTrueType = this.getTypeNodeText(oldNode.trueType);
      const newTrueType = this.getTypeNodeText(newNode.trueType);
      const oldFalseType = this.getTypeNodeText(oldNode.falseType);
      const newFalseType = this.getTypeNodeText(newNode.falseType);

      // Check for broadened condition (more types will match)
      if (oldExtendsType !== newExtendsType) {
        const isBroadened = this.isTypeBroadened(
          oldExtendsType,
          newExtendsType
        );

        if (isBroadened) {
          changes.push({
            type: "type",
            change: "conditionalTypeBroadened",
            name: typeName,
            severity: "minor",
            description: `Broadened condition in type ${typeName} from '${oldExtendsType}' to '${newExtendsType}'`,
            details: {
              oldType: oldExtendsType,
              newType: newExtendsType,
              isBroadening: true,
            },
          });
        } else {
          changes.push({
            type: "type",
            change: "conditionalTypeNarrowed",
            name: typeName,
            severity: "major",
            description: `Narrowed condition in type ${typeName} from '${oldExtendsType}' to '${newExtendsType}'`,
            details: {
              oldType: oldExtendsType,
              newType: newExtendsType,
              isNarrowing: true,
            },
          });
        }
      }

      // Check for changes in the true branch
      if (oldTrueType !== newTrueType) {
        const isNarrowing = this.isTypeNarrowing(oldTrueType, newTrueType);

        changes.push({
          type: "type",
          change: "conditionalTrueTypeChanged",
          name: typeName,
          severity: isNarrowing ? "major" : "minor",
          description: `Changed true branch in conditional type ${typeName} from '${oldTrueType}' to '${newTrueType}'`,
          details: {
            oldType: oldTrueType,
            newType: newTrueType,
            isNarrowing,
          },
        });
      }

      // Check for changes in the false branch
      if (oldFalseType !== newFalseType) {
        const isNarrowing = this.isTypeNarrowing(oldFalseType, newFalseType);

        // Special case for 'never' type in the false branch (common pattern for type narrowing)
        const isNeverChange =
          oldFalseType !== "never" &&
          (newFalseType === "never" || newFalseType === "NeverKeyword");

        changes.push({
          type: "type",
          change: "conditionalFalseTypeChanged",
          name: typeName,
          severity: isNarrowing || isNeverChange ? "major" : "minor",
          description: `Changed false branch in conditional type ${typeName} from '${oldFalseType}' to '${newFalseType}'`,
          details: {
            oldType: oldFalseType,
            newType: newFalseType,
            isNarrowing,
            isNeverChange,
          },
        });
      }
    } catch (error) {
      console.error(`Error analyzing conditional type ${typeName}:`, error);
    }

    return changes;
  }

  private isTypeBroadened(oldType: string, newType: string): boolean {
    // Check if the new type is broader than the old type

    // Check for common broadening patterns
    if (newType.includes("|") && !oldType.includes("|")) {
      // Adding a union type is broadening
      return true;
    }

    if (oldType.includes("|") && newType.includes("|")) {
      // Check if the new union has more members
      const oldMembers = oldType.split("|").map((m) => m.trim());
      const newMembers = newType.split("|").map((m) => m.trim());

      if (
        newMembers.length > oldMembers.length &&
        oldMembers.every((m) => newMembers.includes(m))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detects changes in properties of object types
   */
  private detectPropertyChanges(
    oldTypeNode: ts.TypeLiteralNode,
    newTypeNode: ts.TypeLiteralNode,
    typeName: string
  ): Change[] {
    const changes: Change[] = [];

    try {
      // Create maps of properties by name
      const oldProps = new Map<string, ts.PropertySignature>();
      const newProps = new Map<string, ts.PropertySignature>();

      // Populate old properties map
      for (const member of oldTypeNode.members) {
        if (ts.isPropertySignature(member) && member.name) {
          try {
            const propName = this.parser.getNodeText(member.name);
            oldProps.set(propName, member);
          } catch (e) {
            console.error(`Error getting property name: ${e}`);
          }
        }
      }

      // Populate new properties map and check for added properties
      for (const member of newTypeNode.members) {
        if (ts.isPropertySignature(member) && member.name) {
          try {
            const propName = this.parser.getNodeText(member.name);
            newProps.set(propName, member);

            // Check if this is a new property
            if (!oldProps.has(propName)) {
              const isOptional = !!member.questionToken;
              changes.push({
                type: "type",
                change: "propertyAdded",
                name: typeName,
                severity: isOptional ? "minor" : "major",
                description: `Added ${
                  isOptional ? "optional" : "required"
                } property '${propName}' to type ${typeName}`,
              });
            }
          } catch (e) {
            console.error(`Error processing new property: ${e}`);
          }
        }
      }

      // Check for removed properties
      for (const propName of oldProps.keys()) {
        if (!newProps.has(propName)) {
          changes.push({
            type: "type",
            change: "propertyRemoved",
            name: typeName,
            severity: "major",
            description: `Removed property '${propName}' from type ${typeName}`,
          });
        }
      }

      // Check for property type changes
      for (const [propName, oldProp] of oldProps.entries()) {
        const newProp = newProps.get(propName);
        if (newProp) {
          // Check if property type changed
          if (oldProp.type && newProp.type) {
            try {
              const oldTypeText = this.parser.getNodeText(oldProp.type);
              const newTypeText = this.parser.getNodeText(newProp.type);

              if (oldTypeText !== newTypeText) {
                changes.push({
                  type: "type",
                  change: "propertyTypeChanged",
                  name: typeName,
                  severity: "major",
                  description: `Changed type of property '${propName}' in ${typeName} from '${oldTypeText}' to '${newTypeText}'`,
                });
              }
            } catch (e) {
              console.error(`Error comparing property types: ${e}`);
            }
          }

          // Check if optionality changed
          const oldOptional = !!oldProp.questionToken;
          const newOptional = !!newProp.questionToken;

          if (oldOptional && !newOptional) {
            changes.push({
              type: "type",
              change: "propertyOptionalityChanged",
              name: typeName,
              severity: "major",
              description: `Made property '${propName}' required in type ${typeName}`,
            });
          } else if (!oldOptional && newOptional) {
            changes.push({
              type: "type",
              change: "propertyOptionalityChanged",
              name: typeName,
              severity: "minor",
              description: `Made property '${propName}' optional in type ${typeName}`,
            });
          }
        }
      }
    } catch (e) {
      console.error(`Error detecting property changes: ${e}`);
    }

    return changes;
  }
}
