import * as ts from "typescript";
import * as fs from "fs";
import { AnalyzerConfig } from "../types";

export class TypeScriptParser {
  private _program: ts.Program;
  private _printer: ts.Printer;

  constructor(files: string[], options?: AnalyzerConfig) {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.CommonJS,
      declaration: true,
      ...options?.compilerOptions,
    };

    this._program = ts.createProgram(files, compilerOptions);
    this._printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  }

  public getRootFileNames(): string[] {
    return Array.from(this._program.getRootFileNames());
  }

  public getSourceFile(fileName: string): ts.SourceFile | undefined {
    return this._program.getSourceFile(fileName);
  }

  public getTypeChecker(): ts.TypeChecker {
    return this._program.getTypeChecker();
  }

  public getExportedDeclarations(
    sourceFile: ts.SourceFile | undefined
  ): ts.Declaration[] {
    if (!sourceFile) {
      return [];
    }

    const result: ts.Declaration[] = [];
    const visit = (node: ts.Node) => {
      try {
        if (
          ts.isClassDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isVariableStatement(node)
        ) {
          if (this.isExported(node)) {
            if (ts.isVariableStatement(node)) {
              result.push(...node.declarationList.declarations);
            } else {
              result.push(node);
            }
          }
        }
        ts.forEachChild(node, visit);
      } catch (error) {
        console.error("Error visiting node:", error);
      }
    };

    try {
      visit(sourceFile);
    } catch (error) {
      console.error("Error visiting source file:", error);
    }

    return result;
  }

  private isExported(node: ts.Node): boolean {
    if (ts.canHaveModifiers(node)) {
      const modifiers = ts.getModifiers(node);
      return (
        modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
      );
    }
    return false;
  }

  public isComplexType(type: ts.Type): boolean {
    return (
      this.isGenericType(type) ||
      this.isConditionalType(type) ||
      this.isMappedType(type) ||
      this.isUnionOrIntersectionType(type)
    );
  }

  public isGenericType(type: ts.Type): boolean {
    return !!(type.flags & ts.TypeFlags.TypeParameter);
  }

  public isConditionalType(type: ts.Type): boolean {
    return !!(type.flags & ts.TypeFlags.Conditional);
  }

  public isMappedType(type: ts.Type): boolean {
    if (!(type.flags & ts.TypeFlags.Object)) {
      return false;
    }
    const objectType = type as ts.ObjectType;
    return !!(objectType.objectFlags & ts.ObjectFlags.Mapped);
  }

  public isUnionOrIntersectionType(type: ts.Type): boolean {
    return !!(type.flags & (ts.TypeFlags.Union | ts.TypeFlags.Intersection));
  }

  public getTypeArguments(type: ts.Type): ts.Type[] {
    if (type.isTypeParameter()) {
      const constraint = type.getConstraint();
      return constraint ? [constraint] : [];
    }
    return [];
  }

  public getConstraintType(type: ts.Type): ts.Type | undefined {
    if (type.isTypeParameter()) {
      return type.getConstraint();
    }
    return undefined;
  }

  /**
   * Safely gets the text of a TypeScript node.
   * Falls back to using a printer if direct getText() fails.
   */
  public getNodeText(node: ts.Node): string {
    if (!node) {
      return "";
    }

    try {
      // Try the direct method first
      return node.getText().trim();
    } catch (error) {
      try {
        // If direct getText fails, try to use the printer API
        const sourceFile = node.getSourceFile();
        if (sourceFile) {
          return this._printer
            .printNode(ts.EmitHint.Unspecified, node, sourceFile)
            .trim();
        }
      } catch (printError) {
        // Silent fail and continue to fallbacks
      }

      // Special case handling based on node kind
      if (ts.isIdentifier(node)) {
        return node.escapedText.toString();
      } else if (ts.isPropertySignature(node) || ts.isMethodSignature(node)) {
        if (ts.isIdentifier(node.name)) {
          return node.name.escapedText.toString();
        }
      } else if (
        ts.isTypeReferenceNode(node) &&
        ts.isIdentifier(node.typeName)
      ) {
        return node.typeName.escapedText.toString();
      } else if (ts.isUnionTypeNode(node)) {
        // For union types, reconstruct "type1 | type2 | ..." syntax
        const memberTexts = node.types
          .map((type) => this.getNodeText(type))
          .filter(
            (text) =>
              text && !text.endsWith("Keyword") && !text.endsWith("Type")
          );
        return memberTexts.length > 0 ? memberTexts.join(" | ") : "union-type";
      } else if (ts.isIntersectionTypeNode(node)) {
        // For intersection types, reconstruct "type1 & type2 & ..." syntax
        const memberTexts = node.types
          .map((type) => this.getNodeText(type))
          .filter(
            (text) =>
              text && !text.endsWith("Keyword") && !text.endsWith("Type")
          );
        return memberTexts.length > 0
          ? memberTexts.join(" & ")
          : "intersection-type";
      } else if (node.kind === ts.SyntaxKind.StringKeyword) {
        return "string";
      } else if (node.kind === ts.SyntaxKind.NumberKeyword) {
        return "number";
      } else if (node.kind === ts.SyntaxKind.BooleanKeyword) {
        return "boolean";
      } else if (node.kind === ts.SyntaxKind.AnyKeyword) {
        return "any";
      } else if (node.kind === ts.SyntaxKind.UnknownKeyword) {
        return "unknown";
      } else if (node.kind === ts.SyntaxKind.VoidKeyword) {
        return "void";
      } else if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
        return "undefined";
      } else if (node.kind === ts.SyntaxKind.NullKeyword) {
        return "null";
      } else if (ts.isMappedTypeNode(node)) {
        // Handle mapped type nodes specifically
        try {
          // Try to reconstruct mapped type syntax manually
          const mappedType = node as ts.MappedTypeNode;
          let result = "{ ";

          // Add readonly modifier if present
          if (mappedType.readonlyToken) {
            if (mappedType.readonlyToken.kind === ts.SyntaxKind.PlusToken) {
              result += "+readonly ";
            } else if (
              mappedType.readonlyToken.kind === ts.SyntaxKind.MinusToken
            ) {
              result += "-readonly ";
            } else {
              result += "readonly ";
            }
          }

          // Add the key mapping: [K in keyof T]
          result += "[";
          if (mappedType.typeParameter) {
            result += mappedType.typeParameter.name.text + " in ";
            if (mappedType.typeParameter.constraint) {
              result += this.getNodeText(mappedType.typeParameter.constraint);
            }
          }
          result += "]";

          // Add optional modifier if present
          if (mappedType.questionToken) {
            if (mappedType.questionToken.kind === ts.SyntaxKind.PlusToken) {
              result += "+";
            } else if (
              mappedType.questionToken.kind === ts.SyntaxKind.MinusToken
            ) {
              result += "-";
            }
            result += "?";
          }

          // Add the type
          result += ": ";
          if (mappedType.type) {
            result += this.getNodeText(mappedType.type);
          }

          result += " }";
          return result;
        } catch (mappedError) {
          console.error("Error reconstructing mapped type:", mappedError);
          return "mapped-type";
        }
      }

      // Last resort
      return `${ts.SyntaxKind[node.kind]}`;
    }
  }
}
