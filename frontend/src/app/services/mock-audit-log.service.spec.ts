import { AuthService } from './auth.service';
import { MockAuditLogService } from './mock-audit-log.service';

describe('MockAuditLogService', () => {
  it('records a back-office action only after an operator identity is bound', () => {
    let BoundOperatorAccount: string | null = null;
    const Auth = {
      get BoundBackOfficeUserId(): string | null {
        return BoundOperatorAccount;
      },

      get CanOperateBackOffice(): boolean {
        return BoundOperatorAccount !== null;
      },
    } as unknown as AuthService;

    const AuditLog = new MockAuditLogService(Auth);
    const InitialCount = AuditLog.OperationLogs.length;

    AuditLog.RecordBackOfficeAction('更新使用者權限', '測試');
    expect(AuditLog.OperationLogs).toHaveSize(InitialCount);

    BoundOperatorAccount = 'user@example.com';
    AuditLog.RecordBackOfficeAction(
      '更新使用者權限',
      '測試',
    );

    expect(AuditLog.OperationLogs).toHaveSize(InitialCount + 1);

    const NewLog = AuditLog.OperationLogs[0];

    expect(NewLog.UserId).toBe('user@example.com');
    expect(NewLog.Source).toBe('BackOffice');
    expect(NewLog.Category).toBe('AccountManagement');
    expect(NewLog.Action).toBe('更新使用者權限');
    expect(NewLog.Summary).toBe('測試');
  });
});
