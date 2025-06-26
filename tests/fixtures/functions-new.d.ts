// Arrow function type declarations - with changes
export type SimpleCallback = () => void;
export type DataCallback = (data: string) => number; // MAJOR: return type changed
export type GenericMapper<T, U> = (item: T) => U; // MAJOR: added type parameter
export type EventHandler = (event: { type: string; timestamp: number }) => void; // MAJOR: added required property

// Arrow functions with optional parameters - with changes
export type OptionalCallback = (data?: string, options?: any) => void; // MINOR: added optional parameter
export type MultipleParams = (a: number, b: string, c: boolean) => number; // MAJOR: made optional parameter required

// Arrow functions with rest parameters - with changes
export type RestFunction = (
  ...args: (string | number)[]
) => (string | number)[]; // MINOR: broadened type
export type MixedParams = (
  first: number,
  second: string,
  ...rest: string[]
) => void; // MAJOR: added required parameter

// Complex arrow function types - with changes
export type AsyncMapper<T, U> = (item: T) => Promise<U>;
export type ConditionalFunction<T> = T extends string
  ? (s: T) => string
  : (n: T) => string; // MAJOR: changed return type
export type NewAsyncFunction<T> = (item: T) => Promise<T[]>; // MINOR: new type added

// Arrow function properties in interfaces - with changes
export interface EventEmitter {
  on: (event: string, callback: () => void) => void;
  off: (event: string, callback: () => void) => void;
  emit: (event: string, ...args: any[]) => boolean;
  once: (event: string, callback: () => void) => void; // MINOR: added method
}

// Object with arrow function properties - with changes
export interface ApiClient {
  get: (url: string, options?: RequestInit) => Promise<any>; // MINOR: added optional parameter
  post: (url: string, data: any) => Promise<any>;
  put: (url: string, data: any) => Promise<any>; // MINOR: added method
  delete: (url: string) => Promise<void>;
  patch: (url: string, data: Partial<any>) => Promise<any>; // MINOR: added method
}

// Nested arrow functions - with changes
export type HigherOrder = (fn: (x: number) => number) => (y: number) => string; // MAJOR: changed return type
export type CurriedFunction = (
  a: string
) => (b: number) => (c: boolean) => number; // MAJOR: changed final return type

// Union types with arrow functions - with changes
export type Handler =
  | ((data: string) => void)
  | ((error: Error) => void)
  | ((warning: string) => void); // MINOR: added union member
export type Processor = (input: string | number) => string | number; // MINOR: broadened input type

// New arrow function types
export type FilterFunction<T> = (item: T, index: number) => boolean; // MINOR: new type
export type ReducerFunction<T, U> = (acc: U, current: T, index: number) => U; // MINOR: new type
