export interface SimpleUser {
  id: string;
  name: string;
  email: string;
}

export type UserRole = 'admin' | 'user';

export function login(credentials: { username: string; password: string }): SimpleUser; 