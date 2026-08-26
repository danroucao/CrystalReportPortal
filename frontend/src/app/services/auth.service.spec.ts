import { AuthService } from './auth.service';

describe('AuthService', () => {
  let Auth: AuthService;

  beforeEach(() => {
    Auth = new AuthService();
  });

  it('authenticates the MEMBER Demo account with all report permissions', () => {
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();
    expect(Auth.CurrentUser?.Role).toBe('MEMBER');
    expect(Auth.ReportPermission).toEqual({
      CanView: true,
      CanExecute: true,
      CanExportPdf: true,
      CanPrint: true,
    });
    expect(Auth.IsAdmin).toBeFalse();
  });

  it('authenticates the ADMIN Demo account with management access', () => {
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    expect(Auth.CurrentUser?.Role).toBe('ADMIN');
    expect(Auth.HasManagementPermission('UserManagement')).toBeTrue();
    expect(Auth.HasManagementPermission('OperationLog')).toBeTrue();
  });

  it('rejects incorrect credentials and clears the Demo login state on logout', () => {
    expect(Auth.Login('unknown@example.com', 'wrong')).toBeFalse();
    expect(Auth.IsAuthenticated).toBeFalse();

    Auth.Login('user@example.com', 'user123');
    Auth.Logout();

    expect(Auth.CurrentUser).toBeNull();
    expect(Auth.ReportPermission.CanView).toBeFalse();
  });
});
