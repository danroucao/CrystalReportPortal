import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { NgZone, Type } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { MockRbacService, MockUserDraft } from '../../services/mock-rbac.service';
import { MockReportParameterService } from '../../services/mock-report-parameter.service';
import { MockNotificationCenterService } from '../../services/mock-notification-center.service';
import { NotificationService } from '../../services/notification.service';
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

export function ConfigureDemoPortalTestBed(
  ...components: readonly Type<unknown>[]
): void {
  beforeEach(async () => {
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
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { Page: 'UserManagement' } } },
        },
      ],
    }).compileComponents();
  });
}

export function LoginFrontManager(Auth: AuthService, IncludeManagement = true): boolean {
  const Rbac = TestBed.inject(MockRbacService);
  const Permissions = Rbac.GetCategoryPermissionEntries('FINANCE');
  Permissions.forEach((Entry) => Entry.Permission = { CanExecute: true, CanExport: true, CanPrint: true });
  Rbac.UpdateRole('FINANCE', { DisplayName: '財務人員', ManagementPermissions: IncludeManagement ? ['RptManagement', 'DatabaseConnection', 'OperationLog'] : [], Permissions });
  return Auth.Login('user@example.com', 'user123');
}

export function LoginBoundBackOfficeOperator(Auth: AuthService): boolean {
  return Auth.Login('admin@example.com', 'admin123') &&
    Auth.BindBackOfficeIdentity('user@example.com', 'user123');
}
