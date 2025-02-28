// Test case for zod.extendShape type transformation
// This type definition is from zod v3.23.6

export namespace objectUtil {
  // Type transformation being tested:
  // Single mapped type with union of keys and conditional selection
  export type extendShape<A extends object, B extends object> = {
    [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never;
  };
  
  // Example usage:
  type Example1 = { a: string; shared: number };
  type Example2 = { b: string; shared: string };
  
  // Result should be: { a: string; b: string; shared: string }
  type Result = extendShape<Example1, Example2>;
} 