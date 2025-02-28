// User interface definition - v1
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
}

// Authentication related types
export type AuthMethod = 'password' | 'oauth' | 'sso';

export interface AuthResult {
  /** JWT token */
  token: string;
  /** When the token expires */
  expiresAt: number;
  /** User information */
  user: User;
}

// API response types
export interface ApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if failed */
  error?: string;
} 