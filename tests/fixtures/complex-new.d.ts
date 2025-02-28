// Generic types (added constraint)
export type Container<T extends object> = {
  value: T;
  metadata: Record<string, unknown>;
  tags?: string[]; // Added optional field
};

// Union and intersection types (modified union)
export type Status = 'active' | 'inactive' | 'pending' | 'archived'; // Added value
export type WithTimestamp = { timestamp: number; timezone?: string }; // Added optional field
export type StatusWithTimestamp = Status & WithTimestamp;

// Conditional types (modified condition)
export type IsString<T> = T extends string | number ? true : false; // Broadened condition
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : never; // Changed default

// Mapped types (added readonly)
export type ReadOnly<T> = {
  readonly [P in keyof T]: T[P] extends object ? ReadOnly<T[P]> : T[P]; // Made recursive
};
export type Optional<T> = {
  [P in keyof T]?: T[P] extends object ? Optional<T[P]> : T[P]; // Made recursive
};

// Complex interface with generics (added methods)
export interface Repository<T, K extends keyof T> {
  find(id: T[K]): Promise<T>;
  findAll(): Promise<T[]>;
  findMany(ids: T[K][]): Promise<T[]>; // Added method
  create(data: Omit<T, K>): Promise<T>;
  update(id: T[K], data: Partial<T>): Promise<T>;
  delete(id: T[K]): Promise<void>;
  restore(id: T[K]): Promise<T>; // Added method
}

// Complex type combinations (modified structure)
export type ApiResponse<T, E = Error> = {
  // Added error type parameter
  data: T;
  error?: E;
  metadata: {
    timestamp: number;
    requestId: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean; // Added field
    };
    cache?: {
      // Added optional cache info
      hit: boolean;
      ttl: number;
    };
  };
};

// Recursive types (added optional fields)
export type TreeNode<T> = {
  value: T;
  children: TreeNode<T>[];
  parent?: TreeNode<T>; // Added optional parent reference
  metadata?: Record<string, unknown>; // Added optional metadata
};

// Template literal types (expanded)
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; // Added PATCH
export type Endpoint = `/${string}`;
export type ApiEndpoint =
  | `${HttpMethod} ${Endpoint}`
  | `${HttpMethod} ${Endpoint}/{id}`; // Added ID pattern

// Utility type combinations (modified)
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T; // Simplified implementation
