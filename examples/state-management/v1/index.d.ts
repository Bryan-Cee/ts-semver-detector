// Basic Store Types
export interface Action<T = any> {
  type: string;
  payload?: T;
}

export interface Reducer<S = any, A extends Action = Action> {
  (state: S, action: A): S;
}

export interface Store<S = any, A extends Action = Action> {
  getState(): S;
  dispatch(action: A): void;
  subscribe(listener: () => void): () => void;
}

// State Container
export interface StateContainer<T> {
  state: T;
  setState(newState: Partial<T>): void;
  resetState(): void;
}

// Observable State
export interface Observer<T> {
  next(value: T): void;
  error?(error: Error): void;
  complete?(): void;
}

export interface Observable<T> {
  subscribe(observer: Observer<T>): {
    unsubscribe: () => void;
  };
}

// Context Provider Types
export interface ContextProvider<T> {
  value: T;
  children: React.ReactNode;
}

// State Selector
export type Selector<S, R> = (state: S) => R;

// State Effects
export interface Effect<T = any> {
  dependencies: any[];
  callback: () => void | (() => void);
  cleanup?: () => void;
}

// Async State
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

// State History
export interface StateHistory<T> {
  past: T[];
  present: T;
  future: T[];
  canUndo: boolean;
  canRedo: boolean;
} 