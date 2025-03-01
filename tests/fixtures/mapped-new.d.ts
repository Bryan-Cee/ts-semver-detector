// ReadOnly mapped type with alternative but equivalent syntax
export type ReadOnly<T> = {
  +readonly [K in keyof T]: T[K];
};

// Optional mapped type with alternative but equivalent syntax
export type Optional<T> = {
  [K in keyof T]+?: T[K];
};

// Test with usage examples
export interface User {
  id: string;
  name: string;
  email: string;
}

export type ReadOnlyUser = ReadOnly<User>;
export type OptionalUser = Optional<User>; 