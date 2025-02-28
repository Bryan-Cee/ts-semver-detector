// Enhanced Store Types
export interface Action<T = any> {
  type: string;
  payload?: T;
  meta?: Record<string, unknown>;
  error?: boolean;
}

export interface Reducer<S = any, A extends Action = Action> {
  (state: S, action: A): S;
}

export interface Middleware<S = any, A extends Action = Action> {
  (store: Store<S, A>): (next: (action: A) => void) => (action: A) => void;
}

export interface Store<S = any, A extends Action = Action> {
  getState(): S;
  dispatch(action: A): Promise<void>;
  subscribe(listener: () => void): () => void;
  replaceReducer(nextReducer: Reducer<S, A>): void;
}

// Enhanced State Container
export interface StateContainer<T> {
  state: T;
  setState(newState: Partial<T> | ((prevState: T) => Partial<T>)): void;
  resetState(): void;
  subscribe(callback: (state: T) => void): () => void;
  batch(updates: Array<Partial<T>>): void;
}

// Enhanced Observable State
export interface Observer<T> {
  next(value: T): void;
  error?(error: Error): void;
  complete?(): void;
}

export interface Observable<T> {
  subscribe(observer: Observer<T>): {
    unsubscribe: () => void;
  };
  pipe<R>(...operators: Array<(source: Observable<any>) => Observable<any>>): Observable<R>;
  toPromise(): Promise<T>;
}

// Enhanced Context Provider Types
export interface ContextProvider<T> {
  value: T;
  children: React.ReactNode;
  onChange?: (value: T) => void;
  fallback?: React.ReactNode;
}

// Enhanced State Selector
export type Selector<S, R> = (state: S) => R;
export type MemoizedSelector<S, R> = Selector<S, R> & {
  release: () => void;
  dependencies: Array<Selector<S, any>>;
};

// Enhanced State Effects
export interface Effect<T = any> {
  dependencies: any[];
  callback: () => void | Promise<void> | (() => void);
  cleanup?: () => void | Promise<void>;
  options?: {
    immediate?: boolean;
    debounce?: number;
    throttle?: number;
  };
}

// Enhanced Async State
export interface AsyncState<T, E = Error> {
  data: T | null;
  loading: boolean;
  error: E | null;
  lastUpdated?: number;
  retries?: number;
  status: 'idle' | 'pending' | 'success' | 'error';
}

// Enhanced State History
export interface StateHistory<T> {
  past: T[];
  present: T;
  future: T[];
  canUndo: boolean;
  canRedo: boolean;
  maxHistory?: number;
  undo(): void;
  redo(): void;
  clear(): void;
  jumpTo(index: number): void;
} 