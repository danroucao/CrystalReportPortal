import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NgZone, Type } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import {
  fakeAsync,
  flushMicrotasks,
  TestBed,
  tick,
} from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { AuthenticatedUser } from '../../services/auth-api.models';
import { AuthService } from '../../services/auth.service';
import { MockNotificationCenterService } from '../../services/mock-notification-center.service';
import { NotificationService } from '../../services/notification.service';
import { MockReportParameterService } from '../../services/mock-report-parameter.service';
import { MockRbacService } from '../../services/mock-rbac.service';
import { DemoPortalComponent } from '../demo-portal.component';
import { FavoriteReportPageComponent } from '../favorite-report-page/favorite-report-page.component';
import { OperationLogPageComponent } from '../operation-log-page/operation-log-page.component';
import { ReportManagementPageComponent } from '../report-management-page/report-management-page.component';
import { ReportParameterPageComponent } from '../report-parameter-page/report-parameter-page.component';
import { ReportPreviewPageComponent } from '../report-preview-page/report-preview-page.component';
import { UserManagementPageComponent } from '../user-management-page/user-management-page.component';

export {
  ActivatedRoute,
  AuthService,
  fakeAsync,
  flushMicrotasks,
  FormControl,
  FormGroup,
  MockNotificationCenterService,
  MockRbacService,
  MockReportParameterService,
  NgZone,
  NotificationService,
  Router,
  TestBed,
  tick,
};

interface MutableAuthState {
  Identity: { Kind: 'FrontUser' | 'BackOffice'; Account: string; DisplayName?: string } | null;
  AuthenticatedUser: AuthenticatedUser | null;
  BoundBackOfficeUserAccount: string | null;
}

export function ConfigureDemoPortalTestBed(
  ...components: readonly Type<unknown>[]
): void {
  beforeEach(async () => {
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [
        DemoPortalComponent,
        FavoriteReportPageComponent,
        OperationLogPageComponent,
        ReportManagementPageComponent,
        ReportParameterPageComponent,
        ReportPreviewPageComponent,
        UserManagementPageComponent,
        ...components,
      ],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { Page: 'UserManagement' } } },
        },
      ],
    }).compileComponents();
  });
}

export function LoginFrontManager(
  Auth: AuthService,
  IncludeManagement = true,
): boolean {
  const Rbac = TestBed.inject(MockRbacService);
  const Permissions = Rbac.GetCategoryPermissionEntries('FINANCE');
  Permissions.forEach(
    (Entry) =>
      (Entry.Permission = {
        CanExecute: true,
        CanExport: true,
        CanPrint: true,
      }),
  );
  Rbac.UpdateRole('FINANCE', {
    DisplayName: '財務人員',
    ManagementPermissions: IncludeManagement
      ? ['RptManagement', 'DatabaseConnection', 'OperationLog']
      : [],
    Permissions,
  });

  const User: AuthenticatedUser = {
    userId: 2,
    account: 'user@example.com',
    employeeNo: 'FIN001',
    userName: '財務測試使用者',
    roles: ['FINANCE'],
    permissions: IncludeManagement
      ? [
          'Report.Upload',
          'Report.Maintain',
          'Report.SetParameters',
          'Report.EnableDisable',
          'DataSource.Manage',
          'AuditLog.View',
        ]
      : [],
  };

  const State = Auth as unknown as MutableAuthState;
  State.AuthenticatedUser = User;
  State.Identity = { Kind: 'FrontUser', Account: User.account };
  State.BoundBackOfficeUserAccount = null;
  return true;
}

export function LoginBackOffice(Auth: AuthService): boolean {
  const State = Auth as unknown as MutableAuthState;

  State.AuthenticatedUser = null;
  State.Identity = {
    Kind: 'BackOffice',
    Account: 'admin@example.com',
    DisplayName: '系統設定',
  };
  State.BoundBackOfficeUserAccount = null;

  return true;
}

export function LoginBoundBackOfficeOperator(Auth: AuthService): boolean {
  LoginBackOffice(Auth);

  const State = Auth as unknown as MutableAuthState;
  State.BoundBackOfficeUserAccount = 'user@example.com';

  return true;
}
