import * as ts from 'typescript';
import { TypeScriptParser } from '../parser/parser';
import {
  AnalyzerConfig,
  Change,
  ChangeLocation,
  ChangeType,
  Severity,
} from '../types';
import { BaseRule } from '../rules/base-rule';
import { InterfaceRule } from '../rules/interface-rule';
import { TypeRule } from '../rules/type-rule';
import { FunctionRule } from '../rules/function-rule';
import { ClassRule } from '../rules/class-rule';
import { TypeInterfaceConversionRule } from '../rules/type-interface-conversion-rule';

export class TypeScriptDiffAnalyzer {
  private parser: TypeScriptParser;
  private rules: BaseRule[] = [];

  constructor(
    private oldFilePath: string,
    private newFilePath: string,
    private config?: AnalyzerConfig
  ) {
    this.parser = new TypeScriptParser([oldFilePath, newFilePath], config);
    this.initializeRules();
  }

  private initializeRules() {
    this.rules = [
      new TypeInterfaceConversionRule(this.parser),
      new InterfaceRule(this.parser),
      new TypeRule(this.parser),
      new FunctionRule(this.parser),
      new ClassRule(this.parser),
      ...(this.config?.customRules || []),
    ];
  }

  public analyze() {
    const rootFiles = this.parser.getRootFileNames();
    const oldSourceFile = this.parser.getSourceFile(rootFiles[0]);
    const newSourceFile = this.parser.getSourceFile(rootFiles[1]);

    if (!oldSourceFile || !newSourceFile) {
      throw new Error('Could not find source files');
    }

    const oldExports = this.parser.getExportedDeclarations(oldSourceFile);
    const newExports = this.parser.getExportedDeclarations(newSourceFile);

    const changes: Change[] = [];
    const oldExportMap = new Map<string, ts.Declaration[]>();
    const newExportMap = new Map<string, ts.Declaration[]>();

    // Group declarations by name
    this.groupDeclarationsByName(oldExports, oldExportMap);
    this.groupDeclarationsByName(newExports, newExportMap);

    // Check for removed declarations
    for (const [name, oldDeclarations] of oldExportMap) {
      if (!newExportMap.has(name)) {
        changes.push({
          type: this.getChangeType(oldDeclarations[0]),
          change: this.getChangeType(oldDeclarations[0]),
          name,
          severity: 'major',
          description: `Removed ${name}`,
          location: {
            oldFile: this.getNodePosition(oldDeclarations[0]),
          },
        });
      }
    }

    // Check for added and modified declarations
    for (const [name, newDeclarations] of newExportMap) {
      const oldDeclarations = oldExportMap.get(name);
      if (!oldDeclarations) {
        changes.push({
          type: this.getChangeType(newDeclarations[0]),
          change: this.getChangeType(newDeclarations[0]),
          name,
          severity: 'minor',
          description: `Added ${name}`,
          location: {
            newFile: this.getNodePosition(newDeclarations[0]),
          },
        });
        continue;
      }

      // Compare declarations using rules
      for (const rule of this.rules) {
        if (rule.canHandle(oldDeclarations[0], newDeclarations[0])) {
          const ruleChanges = rule.analyze(
            oldDeclarations[0],
            newDeclarations[0]
          );
          changes.push(...ruleChanges);
        }
      }
    }

    return {
      changes,
      summary: this.generateSummary(changes),
      recommendedVersionBump: this.getRecommendedVersionBump(changes),
    };
  }

  private groupDeclarationsByName(
    declarations: ts.Declaration[],
    map: Map<string, ts.Declaration[]>
  ) {
    for (const declaration of declarations) {
      const name = this.getDeclarationName(declaration);
      if (name) {
        const existing = map.get(name) || [];
        existing.push(declaration);
        map.set(name, existing);
      }
    }
  }

  private getDeclarationName(node: ts.Declaration): string | undefined {
    if (ts.isVariableDeclaration(node)) {
      return node.name.getText();
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node)
    ) {
      const symbol = this.parser
        .getTypeChecker()
        .getSymbolAtLocation(node.name!);
      return symbol?.getName();
    }
    return undefined;
  }

  private getChangeType(node: ts.Declaration): ChangeType {
    if (ts.isInterfaceDeclaration(node)) return 'interface';
    if (ts.isTypeAliasDeclaration(node)) return 'type';
    if (ts.isFunctionDeclaration(node)) return 'function';
    if (ts.isClassDeclaration(node)) return 'class';
    return 'unknown';
  }

  private getNodePosition(node: ts.Node): ChangeLocation {
    const sourceFile = node.getSourceFile();
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return {
      line: pos.line + 1,
      column: pos.character + 1,
    };
  }

  private generateSummary(changes: Change[]) {
    return {
      totalChanges: changes.length,
      majorChanges: changes.filter((c) => c.severity === 'major').length,
      minorChanges: changes.filter((c) => c.severity === 'minor').length,
      patchChanges: changes.filter((c) => c.severity === 'patch').length,
    };
  }

  private getRecommendedVersionBump(changes: Change[]): Severity {
    if (changes.some((c) => c.severity === 'major')) return 'major';
    if (changes.some((c) => c.severity === 'minor')) return 'minor';
    if (changes.some((c) => c.severity === 'patch')) return 'patch';
    return 'none';
  }
}
