// Arrow function type declarations
export type SimpleCallback = () => void;
export type DataCallback = (data: string) => string;
export type GenericMapper<T> = (item: T) => T;
export type EventHandler = (event: { type: string }) => void;

// Arrow functions with optional parameters
export type OptionalCallback = (data?: string) => void;
export type MultipleParams = (a: number, b: string, c?: boolean) => number;

// Arrow functions with rest parameters
export type RestFunction = (...args: string[]) => string[];
export type MixedParams = (first: number, ...rest: string[]) => void;

// Complex arrow function types
export type AsyncMapper<T, U> = (item: T) => Promise<U>;
export type ConditionalFunction<T> = T extends string
  ? (s: T) => number
  : (n: T) => string;

// Arrow function properties in interfaces
export interface EventEmitter {
  on: (event: string, callback: () => void) => void;
  off: (event: string, callback: () => void) => void;
  emit: (event: string, ...args: any[]) => boolean;
}

// Object with arrow function properties
export interface ApiClient {
  get: (url: string) => Promise<any>;
  post: (url: string, data: any) => Promise<any>;
  delete: (url: string) => Promise<void>;
}

// Nested arrow functions
export type HigherOrder = (fn: (x: number) => number) => (y: number) => number;
export type CurriedFunction = (
  a: string
) => (b: number) => (c: boolean) => string;

// Union types with arrow functions
export type Handler = ((data: string) => void) | ((error: Error) => void);
export type Processor = (input: string) => string | number;
