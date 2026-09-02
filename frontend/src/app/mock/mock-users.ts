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
  {
    Account: 'finance-supervisor@example.com',
    Password: 'financesupervisor123',
    Roles: ['FINANCE'],
    DisplayName: '財務主管 Demo',
    Enabled: true,
    CreatedAt: '2026/08/06 09:10',
    UpdatedAt: '2026/08/06 09:10',
  },
  {
    Account: 'purchasing@example.com',
    Password: 'purchasing123',
    Roles: ['PURCHASE'],
    DisplayName: '採購人員 Demo',
    Enabled: true,
    CreatedAt: '2026/08/07 09:10',
    UpdatedAt: '2026/08/07 09:10',
  },
  {
    Account: 'warehouse-clerk@example.com',
    Password: 'warehouseclerk123',
    Roles: ['WAREHOUSE'],
    DisplayName: '倉管文員 Demo',
    Enabled: true,
    CreatedAt: '2026/08/08 09:10',
    UpdatedAt: '2026/08/08 09:10',
  },
  {
    Account: 'purchase-finance@example.com',
    Password: 'purchasefinance123',
    Roles: ['PURCHASE', 'FINANCE'],
    DisplayName: '採購財務人員 Demo',
    Enabled: true,
    CreatedAt: '2026/08/09 09:10',
    UpdatedAt: '2026/08/09 09:10',
  },
  {
    Account: 'finance-auditor@example.com',
    Password: 'financeauditor123',
    Roles: ['FINANCE'],
    DisplayName: '財務稽核人員 Demo',
    Enabled: true,
    CreatedAt: '2026/08/10 09:10',
    UpdatedAt: '2026/08/10 09:10',
  },
  {
    Account: 'inventory-clerk@example.com',
    Password: 'inventoryclerk123',
    Roles: ['WAREHOUSE'],
    DisplayName: '庫存管理人員 Demo',
    Enabled: false,
    CreatedAt: '2026/08/11 09:10',
    UpdatedAt: '2026/08/11 09:10',
  },
];
