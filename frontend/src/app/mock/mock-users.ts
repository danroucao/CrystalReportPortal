import { MockRoleKey } from './mock-permissions';

export interface MockUser {
  Account: string;
  DisplayName: string;
  Roles: MockRoleKey[];
  Enabled: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface MockUserCredential extends MockUser {
  Password: string;
}

export const MockUsers: readonly MockUserCredential[] = [
  {
    Account: 'user@example.com',
    Password: 'user123',
    Roles: ['FINANCE'],
    DisplayName: '財務人員 Demo',
    Enabled: true,
    CreatedAt: '2026/08/01 09:00',
    UpdatedAt: '2026/08/01 09:00',
  },
  {
    Account: 'admin@example.com',
    Password: 'admin123',
    Roles: ['ADMIN'],
    DisplayName: '系統管理員',
    Enabled: true,
    CreatedAt: '2026/08/01 09:10',
    UpdatedAt: '2026/08/01 09:10',
  },
  {
    Account: 'admin2@example.com',
    Password: 'admin234',
    Roles: ['ADMIN'],
    DisplayName: '系統管理員 B',
    Enabled: true,
    CreatedAt: '2026/08/02 09:10',
    UpdatedAt: '2026/08/02 09:10',
  },
  {
    Account: 'admin3@example.com',
    Password: 'admin345',
    Roles: ['ADMIN'],
    DisplayName: '系統管理員 C',
    Enabled: true,
    CreatedAt: '2026/08/03 09:10',
    UpdatedAt: '2026/08/03 09:10',
  },
  {
    Account: 'purchase-warehouse@example.com',
    Password: 'purchasewarehouse123',
    Roles: ['PURCHASE', 'WAREHOUSE'],
    DisplayName: '採購倉管人員 Demo',
    Enabled: true,
    CreatedAt: '2026/08/04 09:10',
    UpdatedAt: '2026/08/04 09:10',
  },
  {
    Account: 'warehouse@example.com',
    Password: 'warehouse123',
    Roles: ['WAREHOUSE'],
    DisplayName: '倉管人員 Demo',
    Enabled: true,
    CreatedAt: '2026/08/05 09:10',
    UpdatedAt: '2026/08/05 09:10',
  },
];
