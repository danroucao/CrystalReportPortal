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
  {
    Account: 'sales-analyst@example.com',
    Password: 'salesanalyst123',
    Roles: ['FINANCE'],
    DisplayName: '營運分析人員 Demo',
    Enabled: true,
    CreatedAt: '2026/08/12 09:10',
    UpdatedAt: '2026/08/12 09:10',
  },
  {
    Account: 'procurement-lead@example.com',
    Password: 'procurementlead123',
    Roles: ['PURCHASE'],
    DisplayName: '採購主管 Demo',
    Enabled: true,
    CreatedAt: '2026/08/13 09:10',
    UpdatedAt: '2026/08/13 09:10',
  },
  {
    Account: 'warehouse-supervisor@example.com',
    Password: 'warehousesupervisor123',
    Roles: ['WAREHOUSE'],
    DisplayName: '倉儲主管 Demo',
    Enabled: true,
    CreatedAt: '2026/08/14 09:10',
    UpdatedAt: '2026/08/14 09:10',
  },
  {
    Account: 'operations-coordinator@example.com',
    Password: 'operationscoordinator123',
    Roles: ['PURCHASE', 'WAREHOUSE'],
    DisplayName: '營運協調人員 Demo',
    Enabled: true,
    CreatedAt: '2026/08/15 09:10',
    UpdatedAt: '2026/08/15 09:10',
  },
];
