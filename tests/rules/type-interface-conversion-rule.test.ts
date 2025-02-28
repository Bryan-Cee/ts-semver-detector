import * as ts from 'typescript';
import { TypeScriptParser } from '../../src/parser/parser';
import { TypeInterfaceConversionRule } from '../../src/rules/type-interface-conversion-rule';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('TypeInterfaceConversionRule', () => {
  let parser: TypeScriptParser;
  let rule: TypeInterfaceConversionRule;
  let tempDir: string;
  let oldFilePath: string;
  let newFilePath: string;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'typeshift-test-'));
    oldFilePath = path.join(tempDir, 'old.ts');
    newFilePath = path.join(tempDir, 'new.ts');
    
    // Create empty files to ensure they exist
    fs.writeFileSync(oldFilePath, '');
    fs.writeFileSync(newFilePath, '');
  });

  afterEach(() => {
    // Clean up temporary files
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('rule metadata', () => {
    beforeEach(() => {
      parser = new TypeScriptParser([]);
      rule = new TypeInterfaceConversionRule(parser);
    });

    it('should have correct id', () => {
      expect(rule.id).toBe('type-interface-conversion');
    });

    it('should have correct description', () => {
      expect(rule.description).toBe('Analyzes conversions between type aliases and interfaces');
    });
  });

  describe('canHandle', () => {
    beforeEach(() => {
      parser = new TypeScriptParser([]);
      rule = new TypeInterfaceConversionRule(parser);
    });

    it('should handle type to interface conversion', () => {
      const oldNode = ts.factory.createTypeAliasDeclaration(
        undefined,
        ts.factory.createIdentifier('Test'),
        undefined,
        ts.factory.createTypeLiteralNode([])
      );
      const newNode = ts.factory.createInterfaceDeclaration(
        undefined,
        ts.factory.createIdentifier('Test'),
        undefined,
        undefined,
        []
      );

      expect(rule.canHandle(oldNode, newNode)).toBe(true);
    });

    it('should handle interface to type conversion', () => {
      const oldNode = ts.factory.createInterfaceDeclaration(
        undefined,
        ts.factory.createIdentifier('Test'),
        undefined,
        undefined,
        []
      );
      const newNode = ts.factory.createTypeAliasDeclaration(
        undefined,
        ts.factory.createIdentifier('Test'),
        undefined,
        ts.factory.createTypeLiteralNode([])
      );

      expect(rule.canHandle(oldNode, newNode)).toBe(true);
    });

    it('should not handle type to type conversion', () => {
      const oldNode = ts.factory.createTypeAliasDeclaration(
        undefined,
        ts.factory.createIdentifier('Test'),
        undefined,
        ts.factory.createTypeLiteralNode([])
      );
      const newNode = ts.factory.createTypeAliasDeclaration(
        undefined,
        ts.factory.createIdentifier('Test'),
        undefined,
        ts.factory.createTypeLiteralNode([])
      );

      expect(rule.canHandle(oldNode, newNode)).toBe(false);
    });

    it('should not handle interface to interface conversion', () => {
      const oldNode = ts.factory.createInterfaceDeclaration(
        undefined,
        ts.factory.createIdentifier('Test'),
        undefined,
        undefined,
        []
      );
      const newNode = ts.factory.createInterfaceDeclaration(
        undefined,
        ts.factory.createIdentifier('Test'),
        undefined,
        undefined,
        []
      );

      expect(rule.canHandle(oldNode, newNode)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should detect compatible type to interface conversion as minor change', () => {
      const oldCode = `
        type Test = {
          prop: string;
        };
      `;
      const newCode = `
        interface Test {
          prop: string;
        }
      `;

      fs.writeFileSync(oldFilePath, oldCode);
      fs.writeFileSync(newFilePath, newCode);

      // Create a new parser instance with the updated files
      parser = new TypeScriptParser([oldFilePath, newFilePath]);
      rule = new TypeInterfaceConversionRule(parser);

      const oldSourceFile = parser.getSourceFile(oldFilePath);
      const newSourceFile = parser.getSourceFile(newFilePath);

      expect(oldSourceFile).toBeDefined();
      expect(newSourceFile).toBeDefined();

      const oldNode = oldSourceFile!.statements[0] as ts.TypeAliasDeclaration;
      const newNode = newSourceFile!.statements[0] as ts.InterfaceDeclaration;

      const changes = rule.analyze(oldNode, newNode);

      expect(changes).toHaveLength(1);
      expect(changes[0].severity).toBe('minor');
      expect(changes[0].description).toContain('type alias to interface');
      expect(changes[0].details?.reason).toContain('augmentable');
    });

    it('should detect incompatible type to interface conversion as major change', () => {
      const oldCode = `
        type Test = {
          prop: string;
        };
      `;
      const newCode = `
        interface Test {
          prop: number;
        }
      `;

      fs.writeFileSync(oldFilePath, oldCode);
      fs.writeFileSync(newFilePath, newCode);

      // Create a new parser instance with the updated files
      parser = new TypeScriptParser([oldFilePath, newFilePath]);
      rule = new TypeInterfaceConversionRule(parser);

      const oldSourceFile = parser.getSourceFile(oldFilePath);
      const newSourceFile = parser.getSourceFile(newFilePath);

      expect(oldSourceFile).toBeDefined();
      expect(newSourceFile).toBeDefined();

      const oldNode = oldSourceFile!.statements[0] as ts.TypeAliasDeclaration;
      const newNode = newSourceFile!.statements[0] as ts.InterfaceDeclaration;

      const changes = rule.analyze(oldNode, newNode);

      expect(changes).toHaveLength(1);
      expect(changes[0].severity).toBe('major');
      expect(changes[0].description).toContain('incompatible structure');
    });

    it('should detect compatible interface to type conversion as minor change', () => {
      const oldCode = `
        interface Test {
          prop: string;
        }
      `;
      const newCode = `
        type Test = {
          prop: string;
        };
      `;

      fs.writeFileSync(oldFilePath, oldCode);
      fs.writeFileSync(newFilePath, newCode);

      // Create a new parser instance with the updated files
      parser = new TypeScriptParser([oldFilePath, newFilePath]);
      rule = new TypeInterfaceConversionRule(parser);

      const oldSourceFile = parser.getSourceFile(oldFilePath);
      const newSourceFile = parser.getSourceFile(newFilePath);

      expect(oldSourceFile).toBeDefined();
      expect(newSourceFile).toBeDefined();

      const oldNode = oldSourceFile!.statements[0] as ts.InterfaceDeclaration;
      const newNode = newSourceFile!.statements[0] as ts.TypeAliasDeclaration;

      const changes = rule.analyze(oldNode, newNode);

      expect(changes).toHaveLength(1);
      expect(changes[0].severity).toBe('minor');
      expect(changes[0].description).toContain('interface to type alias');
      expect(changes[0].details?.reason).toContain('structural compatibility');
    });

    it('should return empty array for incompatible nodes', () => {
      const oldNode = ts.factory.createTypeAliasDeclaration(
        undefined,
        ts.factory.createIdentifier('Test'),
        undefined,
        ts.factory.createTypeLiteralNode([])
      );
      const newNode = ts.factory.createTypeAliasDeclaration(
        undefined,
        ts.factory.createIdentifier('Test'),
        undefined,
        ts.factory.createTypeLiteralNode([])
      );

      const changes = rule.analyze(oldNode, newNode);
      expect(changes).toHaveLength(0);
    });
  });
}); 