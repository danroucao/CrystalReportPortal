import { Injectable } from '@angular/core';

import { MockAuthenticationProvider } from '../mock/mock-authentication.provider';
import {
  MockManagementPermission,
  MockReportPermission,
  MockRolePermissions,
} from '../mock/mock-permissions';
import { MockUser } from '../mock/mock-users';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private CurrentMockUser: MockUser | null = null;

  get IsDemoAuthenticationEnabled(): boolean {
    return MockAuthenticationProvider.IsEnabled;
  }

  get DemoUsers(): readonly MockUser[] {
    return MockAuthenticationProvider.DemoUsers;
  }

  get CurrentUser(): MockUser | null {
    return this.CurrentMockUser;
  }

  get IsAuthenticated(): boolean {
    return this.CurrentMockUser !== null;
  }

  get IsAdmin(): boolean {
    return this.CurrentMockUser?.Role === 'ADMIN';
  }

  Login(Account: string, Password: string): boolean {
    const AuthenticatedUser = MockAuthenticationProvider.Authenticate(
      Account,
      Password,
    );
    this.CurrentMockUser = AuthenticatedUser;
    return AuthenticatedUser !== null;
  }

  Logout(): void {
    this.CurrentMockUser = null;
  }

  get ReportPermission(): MockReportPermission {
    return this.CurrentMockUser
      ? MockRolePermissions[this.CurrentMockUser.Role].ReportPermission
      : {
          CanView: false,
          CanExecute: false,
          CanExportPdf: false,
          CanPrint: false,
        };
  }

  HasManagementPermission(Permission: MockManagementPermission): boolean {
    return this.CurrentMockUser
      ? MockRolePermissions[
          this.CurrentMockUser.Role
        ].ManagementPermissions.includes(Permission)
      : false;
  }
}
