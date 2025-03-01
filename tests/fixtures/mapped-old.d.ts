// ReadOnly mapped type with original syntax
export type ReadOnly<T> = {
  readonly [P in keyof T]: T[P];
};

// Optional mapped type with original syntax
export type Optional<T> = {
  [P in keyof T]?: T[P];
};

// Test with usage examples
export interface User {
  id: string;
  name: string;
  email: string;
}

export type ReadOnlyUser = ReadOnly<User>;
export type OptionalUser = Optional<User>; 