import { AuthService } from './auth.service';
import { MockAuditLogService } from './mock-audit-log.service';
import { MockRbacService } from './mock-rbac.service';

describe('MockAuditLogService', () => {
  it('keeps current and historical demo events without a separate archive model', () => {
    const AuditLog = new MockAuditLogService(new AuthService(new MockRbacService()));
    const Actions = AuditLog.OperationLogs.map((Entry) => Entry.Action);
    const Sources = AuditLog.OperationLogs.map((Entry) => Entry.Source);
    const Categories = AuditLog.OperationLogs.map((Entry) => Entry.Category);

    expect(AuditLog.OperationLogs).toHaveSize(22);
    expect(AuditLog.OperationLogs.some((Entry) =>
      Entry.OccurredAt < new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    )).toBeTrue();
    expect(Actions).toContain('PARAMETER_CREATE');
    expect(Actions).toContain('REPORT_CREATE');
    expect(Actions).toContain('CREATE_ROLE');
    expect(Actions).toContain('DATABASE_CREATE');
    expect(Actions).toContain('LOGIN_FAILURE');
    expect(Sources).toContain('BackOffice');
    expect(Sources).toContain('FrontOffice');
    expect(Categories).toContain('PermissionChange');
    expect(Categories).toContain('ReportAction');
    expect(Categories).toContain('SystemManagement');
    expect(Categories).toContain('Authentication');
  });

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
