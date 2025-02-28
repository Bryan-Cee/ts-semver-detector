export interface User {
  id: string;
  name: string;
  email: string;
  age?: number; // Added optional property - MINOR
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'; // Broadened type - MINOR
  notifications: boolean;
  language: string; // Added required property - MAJOR
}

export type UserId = string; // Narrowed type - MAJOR

export function createUser(
  data: Partial<User>,
  options?: { validate: boolean }
): User; // Added optional parameter - MINOR

export class UserManager {
  constructor(settings: UserSettings);
  getUser(id: UserId): Promise<User>; // Changed return type - MAJOR
  updateUser(id: UserId, data: Partial<User>): User;
}
