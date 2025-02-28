// Test case for zod.extendShape type transformation
// This type definition is from zod v3.23.7

export namespace objectUtil {
  // Type transformation being tested:
  // Intersection of two mapped types with key filtering
  export type extendShape<A extends object, B extends object> = {
    [K in keyof A as K extends keyof B ? never : K]: A[K];
  } & {
    [K in keyof B]: B[K];
  };
  
  // Example usage:
  type Example1 = { a: string; shared: number };
  type Example2 = { b: string; shared: string };
  
  // Result should be: { a: string; b: string; shared: string }
  type Result = extendShape<Example1, Example2>;
} 