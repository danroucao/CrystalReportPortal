import { AuthService } from './auth.service';
import { MockAuditLogService } from './mock-audit-log.service';
import { MockRbacService } from './mock-rbac.service';

describe('MockAuditLogService', () => {
  it('records a back-office action with the bound front-office user id only after step two', () => {
    const Auth = new AuthService(new MockRbacService());
    const AuditLog = new MockAuditLogService(Auth);
    const InitialCount = AuditLog.OperationLogs.length;

    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    AuditLog.RecordBackOfficeAction('更新使用者權限', '測試');
    expect(AuditLog.OperationLogs).toHaveSize(InitialCount);

    expect(Auth.BindBackOfficeIdentity('user@example.com', 'user123')).toBeTrue();
    AuditLog.RecordBackOfficeAction('更新使用者權限', '測試');
    expect(AuditLog.OperationLogs).toHaveSize(InitialCount + 1);
    expect(AuditLog.OperationLogs[0].UserId).toBe('user@example.com');
  });
});
