import { MockRole } from './mock-permissions';

export interface MockUser {
  readonly Account: string;
  readonly Password: string;
  readonly Role: MockRole;
  readonly DisplayName: string;
}

export const MockUsers: readonly MockUser[] = [
  {
    Account: 'user@example.com',
    Password: 'user123',
    Role: 'MEMBER',
    DisplayName: '一般使用者 Demo',
  },
  {
    Account: 'admin@example.com',
    Password: 'admin123',
    Role: 'ADMIN',
    DisplayName: '系統管理員 Demo',
  },
];
