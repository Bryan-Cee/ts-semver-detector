// User interface definition - v2
export interface User {
  /** Unique identifier */
  id: string;
  /** User's full name */
  name: string;
  /** Email address */
  email: string;
  /** Account creation date */
  createdAt: Date;
  /** Whether account is active */
  active: boolean;
  /** User's profile picture URL - new field */
  avatar?: string;
  /** User's preferences */
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
  };
}

// Authentication related types
export type AuthMethod = 'password' | 'oauth' | 'sso' | 'mfa';

export interface AuthResult {
  /** JWT token */
  token: string;
  /** When the token expires */
  expiresAt: number;
  /** User information */
  user: User;
  /** Refresh token - breaking change (required field) */
  refreshToken: string;
}

// API response types
export interface ApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Response metadata */
  meta?: {
    /** Page number for paginated results */
    page?: number;
    /** Total number of pages */
    totalPages?: number;
  };
}

// New type added
export interface Pagination {
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of items */
  total: number;
} 