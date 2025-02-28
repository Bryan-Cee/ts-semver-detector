export interface SimpleUser {
  id: string;
  name: string;
  email: string;
  age?: number; // Added optional property
}

export type UserRole = 'admin' | 'user' | 'guest'; // Added a new role

export function login(credentials: { username: string; password: string }, options?: { rememberMe: boolean }): SimpleUser; 