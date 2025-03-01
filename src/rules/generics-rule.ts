import * as ts from 'typescript';
import { BaseRule } from './base-rule';
import { Change } from '../types';

/**
 * Rule that specifically handles generic type transformations that should be
 * considered non-breaking even when they change in ways that might be flagged
 * as breaking by other rules.
 */
export class GenericsRule extends BaseRule {
  get id(): string {
    return 'generics';
  }

  get description(): string {
    return 'Analyzes changes in generic type parameters that are semantically compatible';
  }

  canHandle(oldNode: ts.Node, newNode: ts.Node): boolean {
    // Handle type alias declarations, interfaces, function declarations, and methods
    return (
      (ts.isTypeAliasDeclaration(oldNode) && ts.isTypeAliasDeclaration(newNode)) ||
      (ts.isInterfaceDeclaration(oldNode) && ts.isInterfaceDeclaration(newNode)) ||
      (ts.isFunctionDeclaration(oldNode) && ts.isFunctionDeclaration(newNode)) ||
      (ts.isMethodDeclaration(oldNode) && ts.isMethodDeclaration(newNode))
    );
  }

  analyze(oldNode: ts.Node, newNode: ts.Node): Change[] {
    if (!this.canHandle(oldNode, newNode)) {
      return [];
    }

    const changes: Change[] = [];
    
    try {
      // Get the parent type name
      let parentTypeName = 'unknown';
      try {
        if (ts.isTypeAliasDeclaration(oldNode) || ts.isInterfaceDeclaration(oldNode)) {
          parentTypeName = this.parser.getNodeText(oldNode.name);
        } else if (ts.isFunctionDeclaration(oldNode) && oldNode.name) {
          parentTypeName = this.parser.getNodeText(oldNode.name);
        } else if (ts.isMethodDeclaration(oldNode) && oldNode.name) {
          parentTypeName = this.parser.getNodeText(oldNode.name);
        }
      } catch (e) {
        console.error(`Error getting parent type name: ${e}`);
      }
      
      // Extract type parameters from different node types
      const oldTypeParams = this.getTypeParameters(oldNode);
      const newTypeParams = this.getTypeParameters(newNode);
      
      // Compare constraints on type parameters
      if (oldTypeParams && newTypeParams) {
        for (let i = 0; i < Math.min(oldTypeParams.length, newTypeParams.length); i++) {
          try {
            const oldParam = oldTypeParams[i];
            const newParam = newTypeParams[i];
            
            let oldConstraint = '';
            let newConstraint = '';
            let paramName = 'unknown';
            
            try {
              paramName = oldParam.name ? this.parser.getNodeText(oldParam.name) : 'unknown';
            } catch (e) {
              console.error(`Error getting param name: ${e}`);
            }
            
            try {
              oldConstraint = oldParam.constraint ? this.parser.getNodeText(oldParam.constraint) : '';
            } catch (e) {
              console.error(`Error getting old constraint text: ${e}`);
            }
            
            try {
              newConstraint = newParam.constraint ? this.parser.getNodeText(newParam.constraint) : '';
            } catch (e) {
              console.error(`Error getting new constraint text: ${e}`);
            }
            
            // If constraints changed, check if it's a benign change
            if (oldConstraint !== newConstraint) {
              // Case 1: No constraint before, but constraint added now - breaking change
              if (!oldConstraint && newConstraint) {
                changes.push(
                  this.createChange(
                    'type',
                    `${parentTypeName}.${paramName}`,
                    'major',
                    `Added constraint '${newConstraint}' to type parameter ${paramName} in ${parentTypeName}`,
                    oldParam,
                    newParam
                  )
                );
              }
              // Case 2: Had constraint before, but different now - check if it's a benign change
              else if (oldConstraint && newConstraint) {
                // Handle {} to unknown transformation (common in Redux 5.0.1)
                if (this.isEmptyObjectToUnknownTransformation(oldConstraint, newConstraint)) {
                  changes.push(
                    this.createChange(
                      'type',
                      `${parentTypeName}.${paramName}`,
                      'patch', // Downgrade from major to patch
                      `Changed constraint from '${oldConstraint}' to '${newConstraint}' (compatible change) in ${parentTypeName}`,
                      oldParam,
                      newParam,
                      { overrideDefault: true }
                    )
                  );
                } else {
                  // Any other constraint change is potentially breaking
                  changes.push(
                    this.createChange(
                      'type',
                      `${parentTypeName}.${paramName}`,
                      'major',
                      `Changed constraint from '${oldConstraint}' to '${newConstraint}' in ${parentTypeName}`,
                      oldParam,
                      newParam
                    )
                  );
                }
              }
            }
          } catch (e) {
            console.error(`Error processing type parameter at index ${i}: ${e}`);
          }
        }
      }
      
      // Handle changes to function and method return types
      this.analyzeFunctionReturnTypeChanges(oldNode, newNode, changes);
    } catch (e) {
      console.error(`Error in GenericsRule.analyze: ${e}`);
    }
    
    return changes;
  }
  
  /**
   * Helper method to get type parameters from various node types
   */
  protected getTypeParameters(node: ts.Node): ts.TypeParameterDeclaration[] | undefined {
    if (ts.isTypeAliasDeclaration(node) || 
        ts.isInterfaceDeclaration(node) || 
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node)) {
      return node.typeParameters ? Array.from(node.typeParameters) : undefined;
    }
    return undefined;
  }
  
  /**
   * Analyzes changes in function return types that might involve UnknownIfNonSpecific
   * or similar transformations that should be considered non-breaking
   */
  protected analyzeFunctionReturnTypeChanges(oldNode: ts.Node, newNode: ts.Node, changes: Change[]): void {
    try {
      // Handle function declarations
      if (ts.isFunctionDeclaration(oldNode) && ts.isFunctionDeclaration(newNode)) {
        this.checkReturnTypeChanges(oldNode, newNode, changes);
      }
      // Handle method declarations
      else if (ts.isMethodDeclaration(oldNode) && ts.isMethodDeclaration(newNode)) {
        this.checkReturnTypeChanges(oldNode, newNode, changes);
      }
    } catch (e) {
      console.error(`Error in analyzeFunctionReturnTypeChanges: ${e}`);
    }
  }
  
  /**
   * Helper to check return type changes for both functions and methods
   */
  protected checkReturnTypeChanges(
    oldNode: ts.FunctionDeclaration | ts.MethodDeclaration, 
    newNode: ts.FunctionDeclaration | ts.MethodDeclaration, 
    changes: Change[]
  ): void {
    try {
      // Use the parser's safer getNodeText method instead of direct getText calls
      const oldReturnType = oldNode.type ? this.parser.getNodeText(oldNode.type) : 'implicit any';
      const newReturnType = newNode.type ? this.parser.getNodeText(newNode.type) : 'implicit any';
      
      if (oldReturnType && newReturnType && oldReturnType !== newReturnType) {
        // Check for UnknownIfNonSpecific wrapping in the return type
        if (this.containsUnknownIfNonSpecificTransformation(oldReturnType, newReturnType)) {
          // Get function or method name
          let name = 'anonymous';
          try {
            if (ts.isFunctionDeclaration(oldNode) && oldNode.name) {
              name = this.parser.getNodeText(oldNode.name);
            } else if ('name' in oldNode && oldNode.name) {
              name = this.parser.getNodeText(oldNode.name);
            }
          } catch (e) {
            console.error(`Error getting function name: ${e}`);
          }
          
          // Get parent type name if this is a method
          let parentTypeName = '';
          if (ts.isMethodDeclaration(oldNode)) {
            try {
              const parent = oldNode.parent;
              if (parent && (ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent)) && parent.name) {
                parentTypeName = this.parser.getNodeText(parent.name);
                name = `${parentTypeName}.${name}`;
              }
            } catch (e) {
              console.error(`Error getting parent type name: ${e}`);
            }
          }
          
          changes.push(
            this.createChange(
              'function', // Use 'function' for both functions and methods since ChangeType doesn't have 'method'
              name,
              'patch', // Downgrade from major to patch
              `Return type enhanced with UnknownIfNonSpecific (compatible change)`,
              oldNode,
              newNode,
              { 
                overrideDefault: true, // Mark that this change should override the default behavior
                oldType: oldReturnType,
                newType: newReturnType
              }
            )
          );
        }
      }
    } catch (e) {
      console.error(`Error in checkReturnTypeChanges: ${e}`);
    }
  }
  
  /**
   * Detects if this is a change from {} constraint to unknown constraint
   * which is considered a non-breaking change in TypeScript
   */
  protected isEmptyObjectToUnknownTransformation(oldConstraint: string, newConstraint: string): boolean {
    try {
      if (!oldConstraint || !newConstraint) {
        return false;
      }
      
      // Normalize constraints by removing whitespace
      const normalizedOld = oldConstraint.replace(/\s+/g, '');
      const normalizedNew = newConstraint.replace(/\s+/g, '');
      
      return (normalizedOld === '{}' && normalizedNew === 'unknown');
    } catch (e) {
      console.error(`Error in isEmptyObjectToUnknownTransformation: ${e}`);
      return false;
    }
  }
  
  /**
   * Detects if this is a transformation using UnknownIfNonSpecific
   * which is a compatibility helper type (as seen in Redux 5.0.1)
   * This checks for direct wrapping of the entire type.
   */
  protected isUnknownIfNonSpecificTransformation(oldType: string, newType: string): boolean {
    try {
      if (!oldType || !newType) {
        return false;
      }
      
      // Check if the new type contains UnknownIfNonSpecific<X> where X was in the old type
      if (!newType.includes('UnknownIfNonSpecific<')) {
        return false;
      }
      
      // Normalize types by removing whitespace
      const normalizedOld = oldType.replace(/\s+/g, '');
      const normalizedNew = newType.replace(/\s+/g, '');
      
      if (!normalizedOld || !normalizedNew) {
        return false;
      }
      
      // Simple case - direct wrapping
      if (normalizedNew === `UnknownIfNonSpecific<${normalizedOld}>`) {
        return true;
      }
      
      // More complex cases inside other types
      try {
        return normalizedNew.includes(`UnknownIfNonSpecific<${normalizedOld}>`) &&
              // Ensure it's just a wrapper and not a completely different type
              normalizedOld.replace(/\s+/g, '').replace(/<.*>/g, '') === 
              normalizedNew.replace(/\s+/g, '').replace(/UnknownIfNonSpecific<|>/g, '').replace(/<.*>/g, '');
      } catch (innerError) {
        console.error('Error in regex comparison:', innerError);
        return false;
      }
    } catch (e) {
      console.error(`Error in isUnknownIfNonSpecificTransformation: ${e}`);
      return false;
    }
  }
  
  /**
   * Detects if a type parameter inside a complex type is wrapped with UnknownIfNonSpecific
   * This handles cases like: Store<S, A, StateExt> -> Store<S, A, UnknownIfNonSpecific<StateExt>>
   */
  protected containsUnknownIfNonSpecificTransformation(oldType: string, newType: string): boolean {
    try {
      // Quick check - if no UnknownIfNonSpecific at all, return false
      if (!newType || !newType.includes('UnknownIfNonSpecific')) {
        return false;
      }
      
      // First check the simple case using the existing method
      if (this.isUnknownIfNonSpecificTransformation(oldType, newType)) {
        return true;
      }
      
      // Normalize types by removing whitespace
      const normalizedOld = oldType ? oldType.replace(/\s+/g, '') : '';
      const normalizedNew = newType ? newType.replace(/\s+/g, '') : '';
      
      // If either type is empty after normalization, we can't analyze
      if (!normalizedOld || !normalizedNew) {
        return false;
      }
      
      // Handle the Redux case: Store<S, A, StateExt> & Ext -> Store<S, A, UnknownIfNonSpecific<StateExt>> & Ext
      
      // Extract generic type parameters from both types
      const oldTypeParams = this.extractGenericParameters(normalizedOld);
      const newTypeParams = this.extractGenericParameters(normalizedNew);
      
      // If we can't parse the type parameters, delegate to more specific rules
      if (!oldTypeParams || !newTypeParams) {
        return false;
      }
      
      // If type parameter counts don't match, it's a different structure
      if (oldTypeParams.length !== newTypeParams.length) {
        return false;
      }
      
      // Check if the base type (name before the angle brackets) is the same
      const oldBaseName = normalizedOld.split('<')[0];
      const newBaseName = normalizedNew.split('<')[0];
      
      if (oldBaseName !== newBaseName) {
        return false;
      }
      
      // Check if one or more type parameters were wrapped with UnknownIfNonSpecific
      let hasWrappedParam = false;
      for (let i = 0; i < oldTypeParams.length; i++) {
        const oldParam = oldTypeParams[i];
        const newParam = newTypeParams[i];
        
        // Check if this parameter was wrapped with UnknownIfNonSpecific
        if (newParam === `UnknownIfNonSpecific<${oldParam}>`) {
          hasWrappedParam = true;
          break;
        }
      }
      
      return hasWrappedParam;
    } catch (e) {
      console.error(`Error in containsUnknownIfNonSpecificTransformation: ${e}`);
      return false;
    }
  }
  
  /**
   * Helper to extract generic type parameters from a type string
   * e.g. "Store<S, A, StateExt>" -> ["S", "A", "StateExt"]
   */
  protected extractGenericParameters(typeString: string): string[] | null {
    try {
      if (!typeString) {
        return null;
      }
      
      // Find the content inside the outermost angle brackets
      const match = typeString.match(/<(.+)>/);
      if (!match || !match[1]) {
        return null;
      }
      
      const content = match[1];
      
      // Split by commas, but account for nested angle brackets
      const result: string[] = [];
      let currentParam = '';
      let nestLevel = 0;
      
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        
        if (char === '<') {
          nestLevel++;
          currentParam += char;
        } else if (char === '>') {
          nestLevel--;
          currentParam += char;
        } else if (char === ',' && nestLevel === 0) {
          // Only split on commas at the top level
          result.push(currentParam.trim());
          currentParam = '';
        } else {
          currentParam += char;
        }
      }
      
      // Add the last parameter
      if (currentParam.trim()) {
        result.push(currentParam.trim());
      }
      
      return result.length > 0 ? result : null;
    } catch (e) {
      console.error(`Error extracting generic parameters from "${typeString}":`, e);
      return null;
    }
  }
} 