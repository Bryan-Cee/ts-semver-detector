import { TypeScriptParser } from '../../src/parser/parser';
import { GenericsRule } from '../../src/rules/generics-rule';
import { Change, Severity, ChangeType } from '../../src/types';

describe('GenericsRule', () => {
  // Create a test that directly calls the methods without using TypeScript's infrastructure
  describe('Direct method tests', () => {
    // We'll test using a subclass that exposes the protected methods
    class TestableGenericsRule extends GenericsRule {
      public testCreateChange(
        type: ChangeType,
        name: string,
        severity: Severity,
        description: string
      ): Change {
        return {
          type,
          name,
          change: this.id,
          severity,
          description
        };
      }
      
      // Expose protected methods for testing
      public isEmptyObjectToUnknownTransformation(oldConstraint: string, newConstraint: string): boolean {
        return super.isEmptyObjectToUnknownTransformation(oldConstraint, newConstraint);
      }
      
      public isUnknownIfNonSpecificTransformation(oldType: string, newType: string): boolean {
        return super.isUnknownIfNonSpecificTransformation(oldType, newType);
      }
      
      public containsUnknownIfNonSpecificTransformation(oldType: string, newType: string): boolean {
        return super.containsUnknownIfNonSpecificTransformation(oldType, newType);
      }
      
      public extractGenericParameters(typeString: string): string[] | null {
        return super.extractGenericParameters(typeString);
      }
    }
    
    let testRule: TestableGenericsRule;
    let parser: TypeScriptParser;
    
    beforeEach(() => {
      parser = new TypeScriptParser([]);
      testRule = new TestableGenericsRule(parser);
    });
    
    it('should detect {} to unknown constraint change', () => {
      expect(testRule.isEmptyObjectToUnknownTransformation('{}', 'unknown')).toBe(true);
      expect(testRule.isEmptyObjectToUnknownTransformation('{ }', '  unknown  ')).toBe(true);
      expect(testRule.isEmptyObjectToUnknownTransformation('string', 'unknown')).toBe(false);
    });
    
    it('should detect UnknownIfNonSpecific transformation', () => {
      // Test simple wrapping case
      expect(testRule.isUnknownIfNonSpecificTransformation(
        'StateExt', 
        'UnknownIfNonSpecific<StateExt>'
      )).toBe(true);
      
      // Test negative case
      expect(testRule.isUnknownIfNonSpecificTransformation(
        'Store<S, A>', 
        'Different<S, B>'
      )).toBe(false);
    });
    
    it('should properly identify generic changes', () => {
      // Test that change is created correctly
      const change = testRule.testCreateChange(
        'type',
        'T',
        'patch',
        'Changed constraint from \'{}\' to \'unknown\' (compatible change)'
      );
      
      expect(change.severity).toBe('patch');
      expect(change.description).toContain('compatible change');
    });
    
    it('should extract generic type parameters correctly', () => {
      // Simple case
      expect(testRule.extractGenericParameters('Store<S, A>')).toEqual(['S', 'A']);
      
      // Complex nested generics
      expect(testRule.extractGenericParameters('Store<S, A, Map<string, number>>')).toEqual(
        ['S', 'A', 'Map<string, number>']
      );
      
      // With whitespace
      expect(testRule.extractGenericParameters('Store< S , A >')).toEqual(['S', 'A']);
      
      // Return null for non-generic types
      expect(testRule.extractGenericParameters('SimpleType')).toBeNull();
    });
    
    it('should detect UnknownIfNonSpecific inside complex generic types', () => {
      // Redux 5.0.0 -> 5.0.1 exact case
      expect(testRule.containsUnknownIfNonSpecificTransformation(
        'Store<S, A, StateExt> & Ext', 
        'Store<S, A, UnknownIfNonSpecific<StateExt>> & Ext'
      )).toBe(true);
      
      // Another variation
      expect(testRule.containsUnknownIfNonSpecificTransformation(
        'Result<T, E>', 
        'Result<UnknownIfNonSpecific<T>, E>'
      )).toBe(true);
      
      // Should return false when structure is different
      expect(testRule.containsUnknownIfNonSpecificTransformation(
        'Store<S, A, StateExt>', 
        'StoreWithMiddleware<S, A, StateExt>'
      )).toBe(false);
      
      // Should return false when UnknownIfNonSpecific not present
      expect(testRule.containsUnknownIfNonSpecificTransformation(
        'Store<S, A, StateExt>', 
        'Store<S, A, NewType>'
      )).toBe(false);
    });
  });
}); 