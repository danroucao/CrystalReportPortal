import { MockRoleKey } from './mock-permissions';

export interface MockUser {
  Account: string;
  Password: string;
  Role: MockRoleKey;
  DisplayName: string;
  Enabled: boolean;
}

export const MockUsers: readonly MockUser[] = [
  {
    Account: 'user@example.com',
    Password: 'user123',
    Role: 'FINANCE',
    DisplayName: '財務人員 Demo',
    Enabled: true,
  },
  {
    Account: 'admin@example.com',
    Password: 'admin123',
    Role: 'ADMIN',
    DisplayName: '系統管理員',
    Enabled: true,
  },
  {
    Account: 'admin2@example.com',
    Password: 'admin234',
    Role: 'ADMIN',
    DisplayName: '系統管理員 B',
    Enabled: true,
  },
  {
    Account: 'admin3@example.com',
    Password: 'admin345',
    Role: 'ADMIN',
    DisplayName: '系統管理員 C',
    Enabled: true,
  },
];
