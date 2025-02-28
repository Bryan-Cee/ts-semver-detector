export interface User {
  id: string;
  name: string;
  email: string;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  notifications: boolean;
}

export type UserId = string | number;

export function createUser(data: Partial<User>): User;

export class UserManager {
  constructor(settings: UserSettings);
  getUser(id: UserId): User;
  updateUser(id: UserId, data: Partial<User>): User;
}
