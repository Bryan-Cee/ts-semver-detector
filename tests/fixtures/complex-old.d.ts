// Generic types
export type Container<T> = {
  value: T;
  metadata: Record<string, unknown>;
};

// Union and intersection types
export type Status = 'active' | 'inactive' | 'pending';
export type WithTimestamp = { timestamp: number };
export type StatusWithTimestamp = Status & WithTimestamp;

// Conditional types
export type IsString<T> = T extends string ? true : false;
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

// Mapped types
export type ReadOnly<T> = {
  readonly [P in keyof T]: T[P];
};
export type Optional<T> = {
  [P in keyof T]?: T[P];
};

// Complex interface with generics
export interface Repository<T, K extends keyof T> {
  find(id: T[K]): Promise<T>;
  findAll(): Promise<T[]>;
  create(data: Omit<T, K>): Promise<T>;
  update(id: T[K], data: Partial<T>): Promise<T>;
  delete(id: T[K]): Promise<void>;
}

// Complex type combinations
export type ApiResponse<T> = {
  data: T;
  error?: string;
  metadata: {
    timestamp: number;
    requestId: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
};

// Recursive types
export type TreeNode<T> = {
  value: T;
  children: TreeNode<T>[];
};

// Template literal types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type Endpoint = `/${string}`;
export type ApiEndpoint = `${HttpMethod} ${Endpoint}`;

// Utility type combinations
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
