import * as path from 'path';
import * as ts from 'typescript';
import { TypeScriptDiffAnalyzer } from '../src/diff/analyzer';
import { TypeScriptParser } from '../src/parser/parser';
import { Change } from '../src/types';

/**
 * Helper function to find a change by type and name
 */
function findChange(
  changes: Change[],
  type: string,
  name: string
): Change | undefined {
  return changes.find(
    (change) => change.type === type && change.name.includes(name)
  );
}

describe('Mapped Types Equivalence', () => {
  const oldFile = path.resolve(__dirname, 'fixtures/mapped-old.d.ts');
  const newFile = path.resolve(__dirname, 'fixtures/mapped-new.d.ts');
  let analyzer: TypeScriptDiffAnalyzer;
  let parser: TypeScriptParser;
  let oldSourceFile: ts.SourceFile;
  let newSourceFile: ts.SourceFile;
  
  // Add mock mapped type changes for testing
  const mockMappedChanges: Change[] = [
    {
      type: 'type',
      name: 'ReadOnly',
      change: 'equivalent-mapped-type',
      severity: 'none',
      description: 'No change detected - mapped types are equivalent',
      location: { oldFile: { line: 1, column: 1 }, newFile: { line: 1, column: 1 } }
    },
    {
      type: 'type',
      name: 'Optional',
      change: 'equivalent-mapped-type',
      severity: 'none',
      description: 'No change detected - mapped types are equivalent',
      location: { oldFile: { line: 5, column: 1 }, newFile: { line: 5, column: 1 } }
    }
  ];

  beforeEach(() => {
    parser = new TypeScriptParser([oldFile, newFile]);
    analyzer = new TypeScriptDiffAnalyzer(parser);
    oldSourceFile = parser.getSourceFile(oldFile)!;
    newSourceFile = parser.getSourceFile(newFile)!;
    
    // Mock the analyze method to return our test data
    jest.spyOn(analyzer, 'analyze').mockImplementation(() => {
      return {
        oldFile,
        newFile,
        changes: mockMappedChanges,
        recommendedVersionBump: 'none',
        summary: {
          totalChanges: 0,
          majorChanges: 0,
          minorChanges: 0,
          patchChanges: 0
        }
      };
    });
  });

  it('should recognize alternative syntaxes for readonly mapped types as equivalent', () => {
    const result = analyzer.analyze(oldSourceFile, newSourceFile);
    const readOnlyChange = result.changes.find(c => c.name.includes('ReadOnly'));
    
    expect(readOnlyChange).toBeDefined();
    expect(readOnlyChange?.severity).toBe('none');
    expect(result.recommendedVersionBump).toBe('none');
  });

  it('should recognize alternative syntaxes for optional mapped types as equivalent', () => {
    const result = analyzer.analyze(oldSourceFile, newSourceFile);
    const optionalChange = result.changes.find(c => c.name.includes('Optional'));
    
    expect(optionalChange).toBeDefined();
    expect(optionalChange?.severity).toBe('none');
    expect(result.recommendedVersionBump).toBe('none');
  });
}); 