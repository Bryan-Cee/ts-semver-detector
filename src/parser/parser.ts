import * as ts from 'typescript';
import { AnalyzerConfig } from '../types';

export class TypeScriptParser {
  private _program: ts.Program;

  constructor(files: string[], options?: AnalyzerConfig) {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.CommonJS,
      declaration: true,
      ...options?.compilerOptions,
    };

    this._program = ts.createProgram(files, compilerOptions);
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

  public getExportedDeclarations(sourceFile: ts.SourceFile): ts.Declaration[] {
    const result: ts.Declaration[] = [];
    const visit = (node: ts.Node) => {
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
    };
    visit(sourceFile);
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

  public getNodePosition(node: ts.Node): { line: number; column: number } {
    const sourceFile = node.getSourceFile();
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return {
      line: pos.line + 1,
      column: pos.character + 1,
    };
  }
}
