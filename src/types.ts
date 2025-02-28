import { BaseRule } from './rules/base-rule';
import * as ts from 'typescript';

export type Severity = 'major' | 'minor' | 'patch' | 'none';
export type ChangeType =
  | 'interface'
  | 'type'
  | 'function'
  | 'class'
  | 'unknown';

export interface Location {
  line: number;
  column: number;
}

export interface ChangeLocation {
  line: number;
  column: number;
}

export interface Rule {
  id: string;
  description: string;
  canHandle(oldNode: ts.Node, newNode: ts.Node): boolean;
  analyze(oldNode: ts.Node, newNode: ts.Node): Change[];
}

export interface Change {
  type: ChangeType;
  change: string;
  name: string;
  severity: Severity;
  description: string;
  location?: {
    oldFile?: ChangeLocation;
    newFile?: ChangeLocation;
  };
  details?: Record<string, unknown>;
  oldType?: string;
  newType?: string;
}

export interface AnalysisResult {
  recommendedVersionBump: Severity;
  changes: Change[];
  summary: {
    totalChanges: number;
    majorChanges: number;
    minorChanges: number;
    patchChanges: number;
  };
}

export interface RuleOverride {
  id: string;
  severity?: Severity;
  enabled?: boolean;
}

export interface AnalyzerConfig {
  ignorePatterns?: string[];
  customRules?: BaseRule[];
  ruleOverrides?: RuleOverride[];
  ignorePrivateMembers?: boolean;
  ignoreInternalMembers?: boolean;
  treatMissingAsUndefined?: boolean;
  treatUndefinedAsAny?: boolean;
  compilerOptions?: Record<string, unknown>;
}

export interface ParserOptions extends AnalyzerConfig {
  // Additional parser-specific options can be added here
}

export interface CliOptions extends AnalyzerConfig {
  oldFile: string;
  newFile: string;
  format?: 'json' | 'text' | 'html';
  output?: string;
  verbose?: boolean;
  config?: string;
}
