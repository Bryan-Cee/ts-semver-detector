import * as path from 'path';
import * as ts from 'typescript';
import { TypeScriptDiffAnalyzer } from '../src/diff/analyzer';
import { Change } from '../src/types';
import { TypeScriptParser } from '../src/parser/parser';

describe('TypeScriptDiffAnalyzer', () => {
  describe('Basic Type Changes', () => {
    const oldFile = path.resolve(__dirname, 'fixtures/old.d.ts');
    const newFile = path.resolve(__dirname, 'fixtures/new.d.ts');
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

    it('should detect the correct version bump', () => {
      const result = analyzer.analyze(oldSourceFile, newSourceFile);
      expect(result.recommendedVersionBump).toBe('major');
    });

    describe('Interface Changes', () => {
      it('should detect added optional properties as minor changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(result.changes, 'interface', 'User', 'age');
        expect(change).toBeDefined();
        expect(change?.severity).toBe('minor');
      });

      it('should detect added required properties as major changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(
          result.changes,
          'interface',
          'UserSettings',
          'language'
        );
        expect(change).toBeDefined();
        expect(change?.severity).toBe('major');
      });
    });

    describe('Type Changes', () => {
      it('should detect type narrowing as major changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(result.changes, 'type', 'UserId');
        expect(change).toBeDefined();
        expect(change?.severity).toBe('major');
        expect(change?.description).toContain('Narrowed type');
      });
    });

    describe('Function Changes', () => {
      it('should detect added optional parameters as minor changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(result.changes, 'function', 'createUser');
        expect(change).toBeDefined();
        expect(change?.severity).toBe('minor');
        expect(change?.description).toContain('optional');
      });
    });

    describe('Class Changes', () => {
      it('should detect return type changes as major changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(
          result.changes,
          'class',
          'UserManager.getUser'
        );
        expect(change).toBeDefined();
        expect(change?.severity).toBe('major');
        expect(change?.description).toContain('return type');
      });
    });
  });

  describe('Complex Type Changes', () => {
    const oldFile = path.resolve(__dirname, 'fixtures/complex-old.d.ts');
    const newFile = path.resolve(__dirname, 'fixtures/complex-new.d.ts');
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

    describe('Generic Types', () => {
      it('should detect added type constraints as major changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(result.changes, 'type', 'Container');
        expect(change).toBeDefined();
        expect(change?.severity).toBe('major');
      });

      it('should detect added optional fields as minor changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(result.changes, 'type', 'Container', 'tags');
        expect(change).toBeDefined();
        expect(change?.severity).toBe('minor');
      });
    });

    describe('Union and Intersection Types', () => {
      it('should detect added union members as minor changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(result.changes, 'type', 'Status', 'archived');
        expect(change).toBeDefined();
        expect(change?.severity).toBe('minor');
      });

      it('should detect added optional fields in intersection types as minor changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(
          result.changes,
          'type',
          'WithTimestamp',
          'timezone'
        );
        expect(change).toBeDefined();
        expect(change?.severity).toBe('minor');
      });
    });

    describe('Conditional Types', () => {
      it('should detect broadened conditions as minor changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(result.changes, 'type', 'IsString');
        expect(change).toBeDefined();
        expect(change?.severity).toBe('minor');
      });

      it('should detect narrowed defaults as major changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(result.changes, 'type', 'UnwrapPromise');
        expect(change).toBeDefined();
        expect(change?.severity).toBe('major');
      });
    });

    describe('Complex Interfaces', () => {
      it('should detect added methods as minor changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const changes = result.changes.filter(
          (c) =>
            c.type === 'interface' &&
            c.name.includes('Repository') &&
            ['findMany', 'restore'].some((m) => c.description.includes(m))
        );
        expect(changes.length).toBe(2);
        changes.forEach((change) => {
          expect(change.severity).toBe('minor');
        });
      });
    });

    describe('Template Literal Types', () => {
      it('should detect added union members in template literals as minor changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(
          result.changes,
          'type',
          'HttpMethod',
          'PATCH'
        );
        expect(change).toBeDefined();
        expect(change?.severity).toBe('minor');
      });

      it('should detect expanded patterns as minor changes', () => {
        const result = analyzer.analyze(oldSourceFile, newSourceFile);
        const change = findChange(
          result.changes,
          'type',
          'ApiEndpoint',
          '{id}'
        );
        expect(change).toBeDefined();
        expect(change?.severity).toBe('minor');
      });
    });

    it('should handle large type definitions efficiently', () => {
      const startTime = Date.now();
      const result = analyzer.analyze(oldSourceFile, newSourceFile);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Analysis should complete in a reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000);
      expect(result.changes.length).toBeGreaterThan(0);
    });
  });

  it('should provide correct location information', () => {
    const oldFile = path.resolve(__dirname, 'fixtures/old.d.ts');
    const newFile = path.resolve(__dirname, 'fixtures/new.d.ts');
    const parser = new TypeScriptParser([oldFile, newFile]);
    const analyzer = new TypeScriptDiffAnalyzer(parser);
    const oldSourceFile = parser.getSourceFile(oldFile)!;
    const newSourceFile = parser.getSourceFile(newFile)!;
    
    const result = analyzer.analyze(oldSourceFile, newSourceFile);
    const changes = result.changes;

    changes.forEach((change) => {
      if (change.location) {
        if (change.location.oldFile) {
          expect(change.location.oldFile).toHaveProperty('line');
          expect(change.location.oldFile).toHaveProperty('column');
        }
        if (change.location.newFile) {
          expect(change.location.newFile).toHaveProperty('line');
          expect(change.location.newFile).toHaveProperty('column');
        }
      }
    });
  });
});

function findChange(
  changes: Change[],
  type: string,
  name: string,
  property?: string
): Change | undefined {
  return changes.find(
    (change) =>
      change.type === type &&
      change.name.includes(name) &&
      (!property || change.description.includes(property))
  );
}
