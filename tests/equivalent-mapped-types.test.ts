import * as path from 'path';
import * as ts from 'typescript';
import { TypeScriptDiffAnalyzer } from '../src/diff/analyzer';
import { Change } from '../src/types';
import { TypeScriptParser } from '../src/parser/parser';

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

describe('Equivalent Type Transformations', () => {
  describe('Mapped Type to Intersection Type Transformation', () => {
    const oldFile = path.resolve(__dirname, 'fixtures/zod-extendshape-old.d.ts');
    const newFile = path.resolve(__dirname, 'fixtures/zod-extendshape-new.d.ts');
    let analyzer: TypeScriptDiffAnalyzer;
    let parser: TypeScriptParser;
    let oldSourceFile: ts.SourceFile;
    let newSourceFile: ts.SourceFile;

    beforeEach(() => {
      parser = new TypeScriptParser([oldFile, newFile]);
      analyzer = new TypeScriptDiffAnalyzer(parser);
      oldSourceFile = parser.getSourceFile(oldFile)!;
      newSourceFile = parser.getSourceFile(newFile)!;
    });

    it('should detect functionally equivalent transformations as PATCH changes', () => {
      const result = analyzer.analyze(oldSourceFile, newSourceFile);
      
      // Debug output
      console.log('All detected changes:');
      result.changes.forEach(change => {
        console.log(`- ${change.type} ${change.name}: ${change.severity} - ${change.description}`);
      });
      
      // This should be a patch change, not major
      expect(result.recommendedVersionBump).toBe('patch');
      
      // Verify the changes have been properly categorized
      const change = findChange(result.changes, 'type', 'extendShape');
      
      expect(change).toBeDefined();
      expect(change?.severity).toBe('patch');
      expect(change?.description).toContain('Functionally equivalent type transformation');
    });
    
    it('should specifically handle the zod.extendShape case correctly', () => {
      const result = analyzer.analyze(oldSourceFile, newSourceFile);
      
      // Check for specific pattern in the changes
      const change = findChange(result.changes, 'type', 'extendShape');
      
      expect(change).toBeDefined();
      expect(change?.severity).toBe('patch');
      
      // Verify the structure matches what we expect
      expect(change?.name).toContain('extendShape');
    });
  });
}); 