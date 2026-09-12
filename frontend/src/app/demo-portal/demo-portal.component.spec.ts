import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { MockRbacService, MockUserDraft } from '../services/mock-rbac.service';
import { MockReportParameterService } from '../services/mock-report-parameter.service';
import { MockNotificationCenterService } from '../services/mock-notification-center.service';
import { NotificationService } from '../services/notification.service';
import { DemoPortalComponent } from './demo-portal.component';

function LoginFrontManager(Auth: AuthService, IncludeManagement = true): boolean {
  const Rbac = TestBed.inject(MockRbacService);
  const Permissions = Rbac.GetCategoryPermissionEntries('FINANCE');
  Permissions.forEach((Entry) => Entry.Permission = { CanExecute: true, CanExport: true, CanPrint: true });
  Rbac.UpdateRole('FINANCE', { DisplayName: '財務人員', ManagementPermissions: IncludeManagement ? ['RptManagement', 'DatabaseConnection', 'OperationLog'] : [], Permissions });
  return Auth.Login('user@example.com', 'user123');
}

function LoginBoundBackOfficeOperator(Auth: AuthService): boolean {
  return Auth.Login('admin@example.com', 'admin123') &&
    Auth.BindBackOfficeIdentity('user@example.com', 'user123');
}

describe('DemoPortalComponent', () => {
  it('settles after identity binding and repeated user dialog interactions', async () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const Zone = TestBed.inject(NgZone);
    const Host = fixture.nativeElement as HTMLElement;
    fixture.autoDetectChanges();
    await fixture.whenStable();
    Zone.run(() => {
      for (const [Name, Value] of [
        ['backOfficeBindingAccount', 'user@example.com'],
        ['backOfficeBindingPassword', 'user123'],
      ]) {
        const Input = Host.querySelector<HTMLInputElement>(`input[name="${Name}"]`)!;
        Input.value = Value;
        Input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      Host.querySelector<HTMLButtonElement>('.back-office-binding-modal .primary-button')!.click();
    });
    await fixture.whenStable();
    expect(Auth.CanOperateBackOffice).toBeTrue();
    expect(Host.querySelector('.back-office-binding-backdrop')).toBeNull();
    expect(Host.querySelectorAll('[inert]').length).toBe(0);

    for (let Round = 0; Round < 3; Round++) {
      Zone.run(() => Host.querySelector<HTMLElement>('.user-account-identity span')!.click());
      await fixture.whenStable();
      expect(Host.querySelector('#edit-user-title')).not.toBeNull();
      Zone.run(() => Host.querySelector<HTMLLabelElement>('.edit-user-role-option')!.click());
      await fixture.whenStable();
      expect(fixture.componentInstance.EditingUser?.Roles).toEqual([]);
      Zone.run(() => Host.querySelector<HTMLButtonElement>('.edit-user-modal .modal-close-button')!.click());
      await fixture.whenStable();
      expect(Host.querySelector('#edit-user-title')).toBeNull();

      Zone.run(() => fixture.componentInstance.OpenCreateUserDialog());
      await fixture.whenStable();
      Zone.run(() => Host.querySelector<HTMLElement>('.create-user-role-option span')!.click());
      await fixture.whenStable();
      expect(fixture.componentInstance.UserDraft.Roles).toEqual(['FINANCE']);
      Zone.run(() => Host.querySelector<HTMLButtonElement>('.create-user-modal .modal-close-button')!.click());
      await fixture.whenStable();
      expect(Host.querySelector('.create-user-modal')).toBeNull();
    }
    fixture.destroy();
  });

  for (const Mode of ['create', 'edit'] as const) {
    it(`preserves role controls and remains responsive in the ${Mode} user dialog`, fakeAsync(() => {
      expect(LoginBoundBackOfficeOperator(TestBed.inject(AuthService))).toBeTrue();
      const fixture = TestBed.createComponent(DemoPortalComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      const Host = fixture.nativeElement as HTMLElement;
      const RoleCard = Host.querySelector('.role-card');
      if (Mode === 'create') {
        component.OpenCreateUserDialog();
      } else {
        // Exercise the real row handler, including clicks on the account text.
        Host.querySelector<HTMLElement>('.user-account-identity span')!.click();
      }
      fixture.detectChanges();
      flushMicrotasks();
      const Selector = `.${Mode}-user-role-option`;
      const Option = Host.querySelector<HTMLLabelElement>(Selector)!;
      expect(Option).not.toBeNull();
      const Checkbox = Option.querySelector<HTMLInputElement>('input')!;
      const InitiallyChecked = Checkbox.checked;
      for (let Round = 0; Round < 4; Round++) {
        fixture.detectChanges();
        flushMicrotasks();
        expect(Host.querySelector(Selector)).toBe(Option);
        expect(Host.querySelector('.role-card')).toBe(RoleCard);
      }
      Checkbox.click();
      fixture.detectChanges();
      flushMicrotasks();
      expect(Checkbox.checked).toBe(!InitiallyChecked);
      Option.click();
      fixture.detectChanges();
      flushMicrotasks();
      expect(Checkbox.checked).toBe(InitiallyChecked);
      if (Mode === 'create') component.CloseCreateUserDialog();
      else component.CancelEditUser();
      fixture.detectChanges();
      expect(Host.querySelector(Selector)).toBeNull();
      fixture.destroy();
      tick(0);
    }));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DemoPortalComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { Page: 'UserManagement' } } },
        },
      ],
    }).compileComponents();
  });

  it('requires front-office identity binding before allowing back-office actions', () => {
    const Auth = TestBed.inject(AuthService);
    const Notifications = TestBed.inject(NotificationService);
    const Navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.back-office-binding-modal')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('main')?.hasAttribute('inert')).toBeTrue();
    component.OpenCreateUserDialog();
    expect(component.IsCreateUserDialogOpen).toBeFalse();
    expect(fixture.nativeElement.querySelector('.back-office-binding-modal')?.textContent)
      .toContain('驗證身分');

    component.BackOfficeBindingAccount = 'unknown@example.com';
    component.BackOfficeBindingPassword = 'wrong';
    component.SubmitBackOfficeIdentityBinding();
    expect(component.BackOfficeBindingError).toBe('帳號或密碼不正確，請重新輸入。');

    component.BackOfficeBindingAccount = 'inventory-clerk@example.com';
    component.BackOfficeBindingPassword = 'inventoryclerk123';
    component.SubmitBackOfficeIdentityBinding();
    expect(component.BackOfficeBindingError).toBe('此帳號已停用。');

    component.ReturnToLoginFromBackOfficeBinding();
    expect(Auth.IsAuthenticated).toBeFalse();
    expect(Navigate).toHaveBeenCalledWith(['/login']);

    expect(Auth.Login('admin@example.com', 'admin123')).toBeTrue();

    component.BackOfficeBindingAccount = 'user@example.com';
    component.BackOfficeBindingPassword = 'user123';
    component.SubmitBackOfficeIdentityBinding();
    fixture.detectChanges();
    expect(Auth.BoundBackOfficeUserId).toBe('user@example.com');
    expect(Notifications.SuccessMessage).toBe('身分驗證成功，已進入後台。');
    expect(fixture.nativeElement.querySelector('.back-office-binding-modal')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[inert]').length).toBe(0);
    component.OpenCreateUserDialog();
    expect(component.IsCreateUserDialogOpen).toBeTrue();
  });

  it('keeps back-office navigation separate and saves both global permissions through role checkboxes', () => {
    const Auth = TestBed.inject(AuthService);
    LoginBoundBackOfficeOperator(Auth);
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const Host = fixture.nativeElement as HTMLElement;
    expect(Array.from(Host.querySelectorAll('aside a')).map((Link) => Link.getAttribute('href')))
      .toEqual(['/admin/users']);
    const UserTable = Host.querySelector('.user-management-table');
    expect(UserTable).not.toBeNull();
    expect(UserTable!.textContent).not.toContain('admin@example.com');
    expect(component.MockRbac.Roles.map((Role) => Role.Key)).not.toContain('ADMIN');
    component.OpenEditRoleDialog('FINANCE');
    fixture.detectChanges();
    const Checkboxes = Host.querySelectorAll<HTMLInputElement>('.role-global-permissions input');
    expect(Checkboxes.length).toBe(3);
    Checkboxes.forEach((Checkbox) => { expect(Checkbox.checked).toBeFalse(); Checkbox.click(); });
    fixture.detectChanges();
    component.SaveEditedRole();
    component.OpenEditRoleDialog('FINANCE');
    fixture.detectChanges();
    expect(component.RoleDraft.ManagementPermissions).toEqual(['DatabaseConnection', 'RptManagement', 'OperationLog']);
    Host.querySelectorAll<HTMLInputElement>('.role-global-permissions input').forEach((Checkbox) => expect(Checkbox.checked).toBeTrue());
    component.CloseEditRoleDialog();
    Auth.Login('user@example.com', 'user123');
    component.OpenCreateUserDialog();
    component.EditUser('warehouse@example.com');
    component.OpenCreateRoleDialog();
    expect(component.IsCreateUserDialogOpen).toBeFalse();
    expect(component.EditingUser).toBeNull();
    expect(component.IsCreateRoleDialogOpen).toBeFalse();
  });

  it('blocks every export format and both print actions after live permission revocation', () => {
    const Auth = TestBed.inject(AuthService);
    const Rbac = TestBed.inject(MockRbacService);
    TestBed.inject(ActivatedRoute).snapshot.data['Page'] = 'ReportPreview';
    LoginFrontManager(Auth);
    Auth.SelectReport('AccountBalance');
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    for (const Option of component.ExportOptions.filter((Entry) => Entry.Enabled)) {
      component.SelectExportOption(Option);
      expect(component.MockNotice).toContain(Option.Label);
    }
    const Permissions = Rbac.GetCategoryPermissionEntries('FINANCE');
    Permissions.find((Entry) => Entry.CategoryId === 'FINANCE')!.Permission = { CanExecute: true, CanExport: false, CanPrint: false };
    Rbac.SaveCategoryPermissions('FINANCE', Permissions);
    component.MockNotice = '';
    component.ToggleExportMenu();
    component.ExportOptions.forEach((Option) => component.SelectExportOption(Option));
    component.SelectOutputAction('BrowserPrint');
    component.SelectOutputAction('FixedPrinterPrint');
    fixture.detectChanges();
    expect(component.MockNotice).toBe('');
    expect(component.IsExportMenuOpen).toBeFalse();
    expect(Auth.SelectedReport).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.export-dropdown')).toBeNull();
    expect(fixture.nativeElement.querySelector('.output-actions')?.textContent).not.toContain('列印');
  });

  it('hides an open management page and rejects changes when its global permission is revoked', () => {
    const Auth = TestBed.inject(AuthService);
    const Rbac = TestBed.inject(MockRbacService);
    const Navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    TestBed.inject(ActivatedRoute).snapshot.data['Page'] = 'RptManagement';
    LoginFrontManager(Auth);
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.OpenUploadReportDialog();
    Rbac.UpdateRole('FINANCE', { DisplayName: '財務人員', ManagementPermissions: [], Permissions: Rbac.GetCategoryPermissionEntries('FINANCE') });
    const WasEnabled = Rbac.GetReport('AccountBalance')!.Enabled;
    component.SetReportEnabled('AccountBalance', !WasEnabled);
    fixture.detectChanges();
    expect(Rbac.GetReport('AccountBalance')!.Enabled).toBe(WasEnabled);
    expect(fixture.nativeElement.querySelector('main')).toBeNull();
    expect(Navigate).toHaveBeenCalledWith(['/reports/parameters'], { queryParams: { state: 'permission-denied' } });
  });

  it('logs out and queues a success notification for the login page', () => {
    const Auth = TestBed.inject(AuthService);
    const Notifications = TestBed.inject(NotificationService);
    const RouterService = TestBed.inject(Router);
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.componentInstance.Logout();

    expect(Auth.IsAuthenticated).toBeFalse();
    expect(Notifications.SuccessMessage).toBe('登出成功！');
    expect(Navigate).toHaveBeenCalledWith(['/login']);
  });

  it('shows the signed-in account and role without a Demo role switcher in the header', () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();
    TestBed.inject(ActivatedRoute).snapshot.data['Page'] = 'ReportParameter';
    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    const Header = fixture.nativeElement.querySelector(
      '.account-summary',
    ) as HTMLElement;
    expect(Header.textContent).toContain(Auth.CurrentUser?.DisplayName);
    expect(Header.textContent).toContain(Auth.ActiveRoleNames);
    expect(Header.querySelector('.role-switcher')).toBeNull();
    expect(Header.querySelector('select')).toBeNull();
    expect(Header.querySelector('button')?.textContent).toContain('登出');
  });

  it('keeps the UserManagement table frame and header for normal, one-user, and empty results', () => {
    const Auth = TestBed.inject(AuthService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const TableFrame = Host.querySelector('.user-table-content-area');
    expect(Host.querySelector('.demo-banner')).toBeNull();
    expect(TableFrame).not.toBeNull();
    expect(Host.querySelector('.user-management-table thead')).not.toBeNull();
    expect(
      Host.querySelectorAll('.user-management-table tbody tr').length,
    ).toBeGreaterThan(1);

    component.UserSearchText = component.FilteredUsers[0].Account;
    fixture.detectChanges();
    expect(
      Host.querySelectorAll('.user-management-table tbody tr').length,
    ).toBe(1);
    expect(Host.querySelector('.user-table-content-area')).toBe(TableFrame);

    component.UserSearchText = 'no-user-match';
    fixture.detectChanges();
    expect(Host.querySelector('.user-management-table thead')).not.toBeNull();
    expect(Host.querySelector('.user-empty-state')?.textContent).toContain(
      '找不到符合條件的使用者。',
    );
    expect(Host.querySelector('.user-table-content-area')).toBe(TableFrame);
  });

  it('renders the approved user management fields, icon actions, and a delete confirmation', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const Headers = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.user-management-table th',
      ),
    ).map((Header) => Header.textContent?.trim());
    expect(Headers).toEqual([
      '帳號',
      '名稱',
      '角色',
      '啟用狀態',
      '建立時間',
      '更新時間',
      '操作',
    ]);
    const FirstAccount = component.PagedUsers[0].Account;
    expect(
      fixture.nativeElement
        .querySelector('.user-account-cell')
        ?.getAttribute('title'),
    ).toBe(FirstAccount);
    expect(
      fixture.nativeElement
        .querySelector('.user-account-identity > span')
        ?.textContent?.trim(),
    ).toBe(FirstAccount);
    expect(
      fixture.nativeElement.querySelector(
        '[aria-label="編輯 user@example.com"]',
      ),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '[aria-label="刪除 user@example.com"]',
      ),
    ).not.toBeNull();

    component.OpenDeleteUserDialog('warehouse@example.com');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      '確定要刪除使用者「warehouse@example.com」嗎？',
    );
    component.ConfirmDeleteUser();
    expect(MockRbac.GetUser('warehouse@example.com')).toBeNull();
  });

  it('keeps account and user name read-only in the administrator edit dialog', () => {
    const Auth = TestBed.inject(AuthService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    component.EditUser('warehouse@example.com');
    fixture.detectChanges();

    const Inputs = (
      fixture.nativeElement as HTMLElement
    ).querySelectorAll<HTMLInputElement>('.edit-user-modal input');
    expect(Inputs[0].disabled).toBeTrue();
    expect(Inputs[1].disabled).toBeTrue();
    expect(
      fixture.nativeElement.querySelector(
        '.edit-user-modal input[type="password"]',
      ),
    ).toBeNull();
    expect(
      (component.EditingUser as unknown as { DisplayName?: string })
        .DisplayName,
    ).toBeUndefined();
  });

  it('updates the EditUser role draft from native checkbox clicks and saves only on confirmation', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    component.EditUser('user@example.com');
    fixture.detectChanges();

    const RoleCheckbox = (RoleName: string) => {
      const Option = Array.from(
        (
          fixture.nativeElement as HTMLElement
        ).querySelectorAll<HTMLLabelElement>('.edit-user-role-option'),
      ).find((Entry) => Entry.textContent?.includes(RoleName))!;
      return Option.querySelector<HTMLInputElement>('input')!;
    };

    expect(component.CanEditEditingUserRoles()).toBeTrue();
    expect(RoleCheckbox('採購人員').disabled).toBeFalse();
    RoleCheckbox('採購人員').click();
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual(['FINANCE', 'PURCHASE']);

    RoleCheckbox('倉管人員').click();
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual([
      'FINANCE',
      'PURCHASE',
      'WAREHOUSE',
    ]);

    RoleCheckbox('財務人員').click();
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual(['PURCHASE', 'WAREHOUSE']);

    expect(MockRbac.Roles.some((Role) => Role.Key === 'ADMIN')).toBeFalse();

    component.CancelEditUser();
    expect(MockRbac.GetUser('user@example.com')?.Roles).toEqual(['FINANCE']);

    component.EditUser('user@example.com');
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual(['FINANCE']);

    RoleCheckbox('採購人員').click();
    fixture.detectChanges();
    expect(component.EditingUser?.Roles).toEqual(['FINANCE', 'PURCHASE']);

    component.SaveEditedUser();
    expect(MockRbac.GetUser('user@example.com')?.Roles).toEqual([
      'FINANCE',
      'PURCHASE',
    ]);
    expect(component.SuccessToastMessage).toBe('使用者資料已更新。');

    component.EditUser('user@example.com');
    expect(component.EditingUser?.Roles).toEqual(['FINANCE', 'PURCHASE']);
  });

  it('lets the signed-in user update only their own name and Mock password in AccountSettings', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const RouterService = TestBed.inject(Router);
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'AccountSettings';
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.AccountSettingsDraft.DisplayName = '財務本人設定';
    component.AccountSettingsDraft.OldPassword = 'incorrect-password';
    component.AccountSettingsDraft.NewPassword = 'self-service-password';
    component.AccountSettingsConfirmation = 'self-service-password';
    component.SaveAccountSettings();

    expect(component.AccountSettingsNotice).toBe('舊密碼不正確。');
    expect(component.IsPasswordChangeSuccessModalOpen).toBeFalse();
    expect(MockRbac.Authenticate('user@example.com', 'user123')).not.toBeNull();

    component.AccountSettingsDraft.OldPassword = 'user123';
    component.AccountSettingsConfirmation = 'different-password';
    component.SaveAccountSettings();

    expect(component.AccountSettingsNotice).toBe('新密碼與確認密碼不一致。');
    expect(component.IsPasswordChangeSuccessModalOpen).toBeFalse();
    expect(MockRbac.Authenticate('user@example.com', 'user123')).not.toBeNull();

    component.AccountSettingsConfirmation = 'self-service-password';
    component.SaveAccountSettings();

    fixture.detectChanges();
    expect(Auth.CurrentUser?.DisplayName).toBe('財務本人設定');
    expect(Auth.CurrentUser?.Roles).toEqual(['FINANCE']);
    expect(Auth.CurrentUser?.Enabled).toBeTrue();
    expect(
      MockRbac.Authenticate('user@example.com', 'self-service-password'),
    ).not.toBeNull();
    expect(component.IsPasswordChangeSuccessModalOpen).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('已成功修改密碼，請重新登入！');
    component.ConfirmPasswordChangeAndLogout();
    expect(Auth.IsAuthenticated).toBeFalse();
    expect(Navigate).toHaveBeenCalledWith(['/login']);

  });

  it('renders only the current user favorites, supports category and date sorting, and keeps report selection flow', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const RouterService = TestBed.inject(Router);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    Route.snapshot.data.Page = 'ReportList';
    expect(LoginFrontManager(Auth, false)).toBeTrue();
    (
      [
        'AccountBalance',
        'Activity',
        'InventoryTransferHana',
        'ProductionOrder',
        'ServiceContract',
      ] as const
    ).forEach((ReportKey) =>
      MockRbac.ToggleFavoriteReport('user@example.com', ReportKey),
    );
    (['AccountBalance', 'Activity'] as const).forEach((ReportKey) =>
      MockRbac.ToggleFavoriteReport('warehouse@example.com', ReportKey),
    );
    (
      [
        'AccountBalance',
        'Activity',
        'ProductionOrder',
        'ServiceContract',
      ] as const
    ).forEach((ReportKey) =>
      MockRbac.RecordReportExecution('user@example.com', ReportKey),
    );

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('.favorite-report-table tbody tr')
        .length,
    ).toBe(5);
    expect(component.FavoriteReports).toHaveSize(5);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
        '#favorite-report-search',
      ),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.favorite-category-tabs'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('#favorite-report-category'),
    ).not.toBeNull();
    expect(
      component.FavoriteReportCategories.map((Category) => Category.CategoryId),
    ).toContain('FINANCE');
    expect(
      component.FavoriteReportCategories.map((Category) => Category.CategoryId),
    ).not.toContain('SYSTEM_UNCATEGORIZED');
    expect(fixture.nativeElement.textContent).not.toContain('最近使用報表');
    expect(fixture.nativeElement.textContent).not.toContain('常用報表');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Documents v2 (With Serial And Batch Details - invoice show data from delivery as well)',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'AccountBalance.rpt',
    );
    expect(
      fixture.nativeElement.querySelector('.favorite-report-table th')
        ?.parentElement?.textContent,
    ).toContain('收藏');
    expect(
      fixture.nativeElement.querySelector('.favorite-report-table th')
        ?.parentElement?.textContent,
    ).toContain('收藏時間');
    expect(
      fixture.nativeElement.querySelector('.favorite-report-table th')
        ?.parentElement?.textContent,
    ).toContain('最近使用日期');
    expect(component.DisplayedFavoriteReports[0].FavoritedAt).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('.favorite-report-table .report-name-cell')
        ?.getAttribute('title'),
    ).toBe(component.DisplayedFavoriteReports[0].Report.ReportName);
    expect(
      fixture.nativeElement.querySelector(
        '.favorite-report-name-sort-button .sort-indicator',
      )?.classList,
    ).not.toContain('is-descending');
    expect(
      fixture.nativeElement
        .querySelector('.favorite-report-name-sort-button')
        ?.closest('th')?.classList,
    ).not.toContain('is-sorted');
    expect(
      fixture.nativeElement
        .querySelectorAll('.favorite-report-table th')[2]
        ?.querySelector('button'),
    ).toBeNull();

    component.SetFavoriteCategory('FINANCE');
    component.FavoriteSearchText = 'Account';
    expect(
      component.DisplayedFavoriteReports.map(({ Report }) => Report.ReportName),
    ).toEqual(['AccountBalance']);
    component.FavoriteSearchText = 'no-match';
    expect(component.DisplayedFavoriteReports).toHaveSize(0);
    component.SetFavoriteCategory(component.AllCategoryFilterValue);
    component.FavoriteSearchText = 'Account';
    expect(
      component.DisplayedFavoriteReports.map(({ Report }) => Report.ReportName),
    ).toEqual(['AccountBalance']);
    component.FavoriteSearchText = 'no-match';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      '找不到符合條件的報表。',
    );
    component.FavoriteSearchText = '';
    component.ToggleFavoriteReportNameSort();
    fixture.detectChanges();
    expect(component.GetFavoriteReportSortIndicator('ReportName')).toBe('↑');
    expect(
      fixture.nativeElement
        .querySelector('.favorite-report-name-sort-button')
        ?.closest('th')?.classList,
    ).toContain('is-sorted');
    expect(
      fixture.nativeElement
        .querySelector('.favorite-last-used-sort-button')
        ?.closest('th')?.classList,
    ).not.toContain('is-sorted');
    component.ToggleFavoriteAtSort();
    fixture.detectChanges();
    expect(component.GetFavoriteReportSortIndicator('FavoritedAt')).toBe('↑');
    expect(
      fixture.nativeElement
        .querySelector('.favorite-at-sort-button')
        ?.closest('th')?.classList,
    ).toContain('is-sorted');
    component.ToggleFavoriteLastUsedSort();
    fixture.detectChanges();
    expect(component.GetFavoriteReportSortIndicator('LastUsedAt')).toBe('↑');
    expect(
      fixture.nativeElement
        .querySelector('.favorite-last-used-sort-button')
        ?.closest('th')?.classList,
    ).toContain('is-sorted');
    expect(component.DisplayedFavoriteReports.at(-1)?.Report.ReportName).toBe(
      'InventoryTransfer_HANA',
    );

    component.SelectReportByKey('AccountBalance');
    expect(Auth.SelectedReport?.ReportKey).toBe('AccountBalance');
    expect(Navigate).toHaveBeenCalledWith(['/reports/preview'], {
      state: { ReportPreviewOrigin: 'favorites' },
    });

    component.RemoveFavoriteReport(
      component.FavoriteReports.find(
        ({ Report }) => Report.ReportKey === 'Activity',
      )!,
    );
    fixture.detectChanges();
    expect(component.FavoriteReports).toHaveSize(4);
    expect(
      MockRbac.GetFavoriteReports('user@example.com'),
    ).toHaveSize(4);
  });

  it('filters favorites through existing report access and keeps table headers for an empty state', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportList';
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();
    MockRbac.ToggleFavoriteReport('user@example.com', 'AccountBalance');

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    MockRbac.SetReportEnabled('AccountBalance', false);
    expect(
      component.FavoriteReports.map(({ Report }) => Report.ReportKey),
    ).not.toContain('AccountBalance');

    [...component.FavoriteReports].forEach((Favorite) =>
      component.RemoveFavoriteReport(Favorite),
    );
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.favorite-report-table'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('.favorite-report-table th')
        .length,
    ).toBe(6);
    expect(
      fixture.nativeElement.querySelector('.favorite-empty-state')?.textContent,
    ).toContain('目前沒有收藏的報表。');
  });

  it('provides report search, single-column sorting, selection, and return on the ReportParameter page', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportParameter';
    expect(LoginFrontManager(Auth, false)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    const RouterService = TestBed.inject(Router);
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    const Host = fixture.nativeElement as HTMLElement;

    expect(component.IsReportParameterMode).toBeFalse();
    expect(Host.querySelector('h1')?.textContent).toContain('所有報表');
    expect(
      Array.from(Host.querySelectorAll('.portal-nav > a')).map((Link) =>
        Link.textContent?.trim(),
      ),
    ).toEqual(['所有報表', '收藏的報表', '帳號設定']);
    expect(
      Array.from(Host.querySelectorAll('.parameter-report-table th')).map(
        (Header) => Header.textContent?.replace(/[↕↑↓]/g, '').trim(),
      ),
    ).toEqual([
      '收藏',
      '報表名稱',
      '報表分類',
      '報表說明',
      '建立時間',
      '更新時間',
      '操作',
    ]);
    expect(
      Host.querySelector(
        '.parameter-report-table .report-name-cell',
      )?.getAttribute('title'),
    ).toBe(component.PagedParameterReports[0].ReportName);
    expect(
      Host.querySelector('.parameter-report-description')?.getAttribute(
        'title',
      ),
    ).toBe(component.PagedParameterReports[0].Description);
    expect(component.DisplayedParameterReports).toHaveSize(12);
    expect(
      Host.querySelector<HTMLInputElement>('#parameter-report-start-date')
        ?.type,
    ).toBe('date');
    expect(
      Host.querySelector<HTMLInputElement>('#parameter-report-end-date')?.type,
    ).toBe('date');
    expect(
      Host.querySelector<HTMLSelectElement>('#parameter-report-category'),
    ).not.toBeNull();
    expect(Host.querySelector('.parameter-search-field svg')).not.toBeNull();
    expect(
      Array.from(
        Host.querySelectorAll<SVGElement>(
          '.sortable-table-header .sort-indicator',
        ),
      ).every(
        (Icon) =>
          !Icon.classList.contains('is-ascending') &&
          !Icon.classList.contains('is-descending'),
      ),
    ).toBeTrue();
    expect(
      component.ParameterReportCategories.map(
        (Category) => Category.CategoryId,
      ),
    ).toContain('FINANCE');
    expect(
      component.ParameterReportCategories.map(
        (Category) => Category.CategoryId,
      ),
    ).not.toContain('SYSTEM_UNCATEGORIZED');
    component.SetParameterReportCategory('FINANCE');
    expect(
      component.DisplayedParameterReports.map((Report) => Report.ReportName),
    ).toEqual(['AccountBalance', 'MonthlyRevenue']);
    component.SetParameterReportCategory(component.AllCategoryFilterValue);
    expect(Host.textContent).not.toContain('RptFileName');
    expect(Host.textContent).not.toContain('RptFilePath');

    component.ParameterReportSearchText = 'Account';
    fixture.detectChanges();
    expect(
      component.DisplayedParameterReports.map((Report) => Report.ReportName),
    ).toEqual(['AccountBalance']);
    component.ToggleParameterReportSort('ReportName');
    fixture.detectChanges();
    expect(component.GetParameterReportSortIndicator('ReportName')).toBe('↑');
    expect(
      Host.querySelector('.sortable-table-header .sort-indicator')?.classList,
    ).toContain('is-ascending');
    expect(component.ParameterReportSearchText).toBe('Account');
    expect(
      Host.querySelector<HTMLButtonElement>(
        '.parameter-favorite-button',
      )?.getAttribute('aria-label'),
    ).toContain('收藏 AccountBalance');
    component.ToggleFavoriteReport('AccountBalance');
    fixture.detectChanges();
    expect(
      Host.querySelector<HTMLButtonElement>(
        '.parameter-favorite-button',
      )?.getAttribute('aria-label'),
    ).toContain('取消收藏 AccountBalance');

    component.ParameterReportSearchText = '';
    component.ToggleParameterReportSort('ReportName');
    fixture.detectChanges();
    expect(component.GetParameterReportSortIndicator('ReportName')).toBe('↓');
    expect(
      Host.querySelector('.sortable-table-header .sort-indicator')?.classList,
    ).toContain('is-descending');
    expect(
      component.DisplayedParameterReports.map((Report) => Report.ReportName),
    ).toEqual(
      [...component.ParameterReports]
        .map((Report) => Report.ReportName)
        .sort((Left, Right) => Right.localeCompare(Left, 'zh-Hant')),
    );
    component.ToggleParameterReportSort('CreatedAt');
    fixture.detectChanges();
    expect(component.GetParameterReportSortIndicator('CreatedAt')).toBe('↑');
    const SortableHeaders = Host.querySelectorAll<HTMLTableCellElement>(
      '.parameter-report-table th[aria-sort]',
    );
    expect(SortableHeaders[0].classList).not.toContain('is-sorted');
    expect(SortableHeaders[1].classList).toContain('is-sorted');
    component.ToggleParameterReportSort('UpdatedAt');
    fixture.detectChanges();
    expect(component.GetParameterReportSortIndicator('UpdatedAt')).toBe('↑');
    expect(SortableHeaders[1].classList).not.toContain('is-sorted');
    expect(SortableHeaders[2].classList).toContain('is-sorted');

    component.SelectReportForPreview('AccountBalance');
    expect(Auth.SelectedReport?.ReportKey).toBe('AccountBalance');
    expect(Auth.SelectedReportSearchCriteria).toBeNull();
    expect(Navigate).toHaveBeenCalledWith(
      ['/reports/preview'],
      jasmine.objectContaining({ state: jasmine.any(Object) }),
    );
    component.ParameterReportStartDate = '2026-09-10';
    component.ParameterReportEndDate = '2026-09-05';
    component.OnParameterReportDateChange();
    expect(component.ParameterReportEndDate).toBe('2026-09-10');
    expect(component.ParameterReportDateValidationMessage).toContain(
      '結束日期不得早於開始日期',
    );
    component.SelectReportForPreview('AccountBalance');
    expect(Auth.SelectedReport?.ReportKey).toBe('AccountBalance');
    expect(Auth.SelectedReportSearchCriteria).toEqual({
      StartDate: '2026-09-10',
      EndDate: '2026-09-10',
    });
    expect(Navigate).toHaveBeenCalledWith(
      ['/reports/preview'],
      jasmine.objectContaining({ state: jasmine.any(Object) }),
    );

    component.SelectReportForParameters('AccountBalance');
    fixture.detectChanges();
    expect(component.IsReportParameterMode).toBeTrue();
    expect(Host.textContent).toContain('已選擇報表');
    expect(Host.textContent).toContain('AccountBalance / 財務');
    expect(Host.querySelector('.parameter-report-table')).toBeNull();

    component.ReturnToParameterReportSearch();
    fixture.detectChanges();
    expect(component.IsReportParameterMode).toBeFalse();
    expect(Host.querySelector('.parameter-report-table')).not.toBeNull();
  });

  it('keeps favorite reports and account settings navigation for non-administrators', () => {
    const Auth = TestBed.inject(AuthService);
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll('.portal-nav > a') as NodeListOf<HTMLAnchorElement>,
      ).map((Link) => Link.textContent?.trim()),
    ).toEqual(['所有報表', '收藏的報表', '帳號設定']);
  });

  it('redirects direct ReportPreview access without a selected report to ReportParameter', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    const RouterService = TestBed.inject(Router);
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    Route.snapshot.data.Page = 'ReportPreview';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    expect(Navigate).toHaveBeenCalledWith(['/reports/parameters'], {
      state: { ReportSelectionRequired: true },
    });
  });

  it('shows only the permitted enabled report catalog to an ordinary user on ReportParameter', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    const RouterService = TestBed.inject(Router);
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    Route.snapshot.data.Page = 'ReportParameter';
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.DisplayedParameterReports).toEqual(
      MockRbac.GetAccessibleReports(Auth.ActiveRoles),
    );
    expect(component.DisplayedParameterReports).toHaveSize(5);
    expect(component.ParameterReportCategories.map((Category) => Category.CategoryId)).toEqual(
      MockRbac.GetReportFilterCategories(Auth.ActiveRoles).map((Category) => Category.CategoryId),
    );

    component.SelectReportForPreview('InventoryTransferHana');

    expect(Auth.SelectedReport).toBeNull();
    expect(Auth.SelectedReportCategoryPermission.CanExecute).toBeFalse();
    expect(Navigate).not.toHaveBeenCalled();
  });

  it('returns from ReportPreview to the report list', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    const RouterService = TestBed.inject(Router);
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    Route.snapshot.data.Page = 'ReportPreview';
    expect(LoginFrontManager(Auth)).toBeTrue();
    Auth.SelectReport('AccountBalance');

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    Navigate.calls.reset();
    component.ReturnToReportList();

    expect(Navigate).toHaveBeenCalledWith(['/reports/parameters'], {
      state: undefined,
    });
    expect(fixture.nativeElement.textContent).toContain('返回所有報表');

    component.ReportPreviewOrigin = 'favorites';
    fixture.detectChanges();
    Navigate.calls.reset();
    component.ReturnToReportList();

    expect(fixture.nativeElement.textContent).toContain('返回我的收藏');
    expect(Navigate).toHaveBeenCalledWith(['/reports']);
  });

  it('distinguishes a report search empty state from no accessible reports', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportParameter';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.ParameterReportSearchText = 'no-match';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      '找不到符合條件的報表。',
    );

    component.ParameterReportSearchText = '';
    MockRbac.Reports.forEach((Report) =>
      MockRbac.SetReportEnabled(Report.ReportKey, false),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      '目前沒有可使用的報表。',
    );
  });

  it('manages reports with a modal-only RPT filename in RptManagement', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'RptManagement';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const Table = Host.querySelector(
      '.report-management-table',
    ) as HTMLTableElement;
    expect(Table.querySelectorAll('tbody tr').length).toBe(10);
    expect(
      Array.from(Table.querySelectorAll('th')).map((Header) =>
        Header.textContent?.trim(),
      ),
    ).toEqual([
      '釘選',
      '報表名稱',
      '報表分類',
      '報表說明',
      '啟用狀態',
      '建立時間',
      '更新時間',
      '操作',
    ]);
    expect(
      Table.querySelector('.report-management-name')?.getAttribute('title'),
    ).toBe(component.PagedManagedReports[0].ReportName);
    expect(
      Table.querySelector('.report-management-description')?.getAttribute(
        'title',
      ),
    ).toBe(component.PagedManagedReports[0].Description);
    expect(Table.querySelectorAll('.sortable-table-header')).toHaveSize(3);
    expect(Table.querySelector('th.report-management-pin-cell')).not.toBeNull();
    expect(
      Table.querySelector('th.report-management-pin-cell > .report-management-pin-header'),
    ).not.toBeNull();
    expect(
      Table.querySelector('td.report-management-pin-cell > .report-management-pin-control'),
    ).not.toBeNull();
    expect(Table.querySelectorAll('th')[0]?.querySelector('button')).toBeNull();
    expect(Table.querySelectorAll('th')[2]?.querySelector('button')).toBeNull();
    const ReportToPin = component.PagedManagedReports[1];
    const PinButtons = Table.querySelectorAll<HTMLButtonElement>(
      '.report-management-pin-button',
    );
    expect(PinButtons[1].getAttribute('aria-pressed')).toBe('false');
    PinButtons[1].click();
    fixture.detectChanges();
    expect(component.IsReportManagementPinned(ReportToPin.ReportKey)).toBeTrue();
    expect(component.DisplayedManagedReports[0].ReportKey).toBe(
      ReportToPin.ReportKey,
    );
    const LatestReportToPin = component.DisplayedManagedReports.at(-1)!;
    component.ToggleReportManagementPin(LatestReportToPin.ReportKey);
    fixture.detectChanges();
    expect(component.ReportManagementCurrentPage).toBe(1);
    expect(component.DisplayedManagedReports[0].ReportKey).toBe(
      LatestReportToPin.ReportKey,
    );
    expect(component.DisplayedManagedReports[1].ReportKey).toBe(
      ReportToPin.ReportKey,
    );
    component.ToggleReportManagementPin(LatestReportToPin.ReportKey);
    fixture.detectChanges();
    expect(component.DisplayedManagedReports[0].ReportKey).toBe(
      ReportToPin.ReportKey,
    );
    component.ToggleReportManagementSort('ReportName');
    fixture.detectChanges();
    expect(component.DisplayedManagedReports[0].ReportKey).toBe(
      ReportToPin.ReportKey,
    );
    expect(
      Table.querySelector<HTMLButtonElement>('.report-management-pin-button')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    Table.querySelector<HTMLButtonElement>('.report-management-pin-button')?.click();
    fixture.detectChanges();
    expect(component.IsReportManagementPinned(ReportToPin.ReportKey)).toBeFalse();
    expect(component.GetReportManagementSortIndicator('ReportName')).toBe('↑');
    expect(
      component.DisplayedManagedReports.map((Report) => Report.ReportName),
    ).toEqual(
      [...component.DisplayedManagedReports]
        .map((Report) => Report.ReportName)
        .sort((Left, Right) => Left.localeCompare(Right, 'zh-Hant')),
    );
    expect(
      Table.querySelector('.report-management-name-sort-button')?.closest('th')
        ?.classList,
    ).toContain('is-sorted');
    component.ToggleReportManagementSort('CreatedAt');
    fixture.detectChanges();
    expect(component.GetReportManagementSortIndicator('CreatedAt')).toBe('↑');
    expect(
      component.DisplayedManagedReports.map((Report) => Report.CreatedAt),
    ).toEqual(
      [...component.DisplayedManagedReports]
        .map((Report) => Report.CreatedAt)
        .sort(),
    );
    expect(
      Table.querySelector('.report-management-name-sort-button')?.closest('th')
        ?.classList,
    ).not.toContain('is-sorted');
    component.ToggleReportManagementSort('UpdatedAt');
    fixture.detectChanges();
    expect(component.GetReportManagementSortIndicator('UpdatedAt')).toBe('↑');
    expect(
      component.DisplayedManagedReports.map((Report) => Report.UpdatedAt),
    ).toEqual(
      [...component.DisplayedManagedReports]
        .map((Report) => Report.UpdatedAt)
        .sort(),
    );
    component.ToggleReportManagementSort('UpdatedAt');
    fixture.detectChanges();
    expect(component.GetReportManagementSortIndicator('UpdatedAt')).toBe('↓');
    expect(Table.querySelectorAll('[role="switch"]').length).toBe(10);
    expect(Host.textContent).not.toContain('AccountBalance.rpt');
    expect(Host.textContent).toContain('停用');
    expect(Host.textContent).toContain('日期篩選對應欄位尚待需求確認（TBD）');
    expect(
      component.ReportManagementCategories.map(
        (Category) => Category.CategoryId,
      ),
    ).toContain('MARKETING');
    expect(
      component.ReportManagementCategories.map(
        (Category) => Category.CategoryId,
      ),
    ).toContain('SYSTEM_UNCATEGORIZED');
    expect(
      Array.from(
        Host.querySelectorAll<HTMLSelectElement>(
          '#report-management-category option',
        ),
      ).map((Option) => Option.value),
    ).toContain('MARKETING');

    const FirstSwitch =
      Table.querySelector<HTMLButtonElement>('[role="switch"]')!;
    const WasEnabled = FirstSwitch.getAttribute('aria-checked') === 'true';
    FirstSwitch.click();
    fixture.detectChanges();
    expect(Table.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe(String(!WasEnabled));

    component.OpenUploadReportDialog();
    fixture.detectChanges();
    expect(Host.querySelector('.report-editor-modal')).not.toBeNull();
    expect(
      Host.querySelector<HTMLTextAreaElement>('#report-editor-description')
        ?.rows,
    ).toBe(3);
    expect(component.ReportEditorDraft.Enabled).toBeFalse();
    expect(
      component.ReportEditorCategories.map((Category) => Category.CategoryId),
    ).toContain('MARKETING');
    expect(
      component.ReportEditorCategories.map((Category) => Category.CategoryId),
    ).not.toContain('SYSTEM_UNCATEGORIZED');
    component.SaveReport();
    expect(component.ReportEditorError).toBe('請輸入報表名稱。');
    component.ReportEditorDraft.ReportName = 'Mock Upload';
    component.ReportEditorDraft.CategoryId = 'FINANCE';
    component.SaveReport();
    expect(component.ReportEditorError).toBe('請輸入報表說明。');
    component.ReportEditorDraft.Description = 'Mock Upload 報表說明';
    component.SaveReport();
    expect(component.ReportEditorError).toBe('請選擇 RPT 報表檔案。');

    const InvalidInput = document.createElement('input');
    Object.defineProperty(InvalidInput, 'files', {
      value: { item: () => new File(['mock'], 'Mock Upload.pdf') },
    });
    component.OnReportFileSelected({
      target: InvalidInput,
    } as unknown as Event);
    expect(component.ReportEditorError).toBe('僅允許上傳 .rpt 報表檔案。');

    const Input = document.createElement('input');
    Object.defineProperty(Input, 'files', {
      value: { item: () => new File(['mock'], 'Mock Upload.rpt') },
    });
    component.OnReportFileSelected({ target: Input } as unknown as Event);
    component.SaveReport();
    fixture.detectChanges();
    expect(
      component.MockRbac.Reports.some(
        (Report) => Report.ReportName === 'Mock Upload',
      ),
    ).toBeTrue();
    expect(
      component.MockRbac.Reports.find(
        (Report) => Report.ReportName === 'Mock Upload',
      )?.Description,
    ).toBe('Mock Upload 報表說明');
    expect(Host.textContent).not.toContain('Mock Upload.rpt');

    const ReservedReport = component.MockRbac.CreateReport({
      ReportName: 'Needs recategorization',
      Description: '需要重新分類的報表。',
      CategoryId: 'SYSTEM_UNCATEGORIZED',
      Enabled: true,
      FileName: 'NeedsRecategorization.rpt',
    })!;
    component.OpenEditReportDialog(ReservedReport.ReportKey);
    fixture.detectChanges();
    expect(component.ReportEditorDraft.CategoryId).toBe('SYSTEM_UNCATEGORIZED');
    expect(
      component.ReportEditorCategories.map((Category) => Category.CategoryId),
    ).toContain('SYSTEM_UNCATEGORIZED');

    const Uploaded = component.MockRbac.Reports.find(
      (Report) => Report.ReportName === 'Mock Upload',
    )!;
    component.OpenEditReportDialog(Uploaded.ReportKey);
    fixture.detectChanges();
    expect(Host.textContent).toContain('目前 RPT 檔案：Mock Upload.rpt');
    expect(component.ReportEditorDraft.Description).toBe(
      'Mock Upload 報表說明',
    );
    component.ReportEditorDraft.Description = '更新後的報表說明';
    component.SaveReport();
    expect(component.MockRbac.GetReport(Uploaded.ReportKey)?.Description).toBe(
      '更新後的報表說明',
    );
    component.OpenDeleteReportDialog(Uploaded.ReportKey);
    fixture.detectChanges();
    expect(Host.textContent).toContain('確定要刪除此報表嗎？');
    component.ConfirmDeleteReport();
    expect(component.MockRbac.GetReport(Uploaded.ReportKey)).toBeNull();
  });

  it('quickly adds a category from the upload modal without resetting the upload draft', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'RptManagement';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    const Host = fixture.nativeElement as HTMLElement;
    component.OpenUploadReportDialog();
    component.ReportEditorDraft = {
      ReportName: '保留中的上傳草稿',
      Description: '保留中的上傳草稿說明',
      CategoryId: 'FINANCE',
      Enabled: true,
    };
    component.SelectedReportFileName = 'DraftReport.rpt';
    fixture.detectChanges();

    expect(
      Host.querySelector('.report-category-quick-add-trigger'),
    ).not.toBeNull();
    expect(
      Array.from(
        Host.querySelectorAll<HTMLSelectElement>(
          '#report-editor-category option',
        ),
      ).map((Option) => Option.value),
    ).not.toContain('SYSTEM_UNCATEGORIZED');

    component.OpenReportCategoryQuickAdd();
    fixture.detectChanges();
    expect(component.IsReportCategoryQuickAddOpen).toBeTrue();
    expect(Host.querySelector('.report-category-quick-add')).not.toBeNull();

    component.QuickAddCategoryName = '   ';
    component.CreateReportCategoryQuickAdd();
    expect(component.QuickAddCategoryError).toBe('請輸入報表分類名稱。');
    component.QuickAddCategoryName = '財務';
    component.CreateReportCategoryQuickAdd();
    expect(component.QuickAddCategoryError).toBe('此報表分類已存在。');
    component.QuickAddCategoryName = '未分類';
    component.CreateReportCategoryQuickAdd();
    expect(component.QuickAddCategoryError).toBe(
      '此名稱為系統保留分類，不可建立。',
    );

    component.QuickAddCategoryName = '快速新增分類';
    component.CreateReportCategoryQuickAdd();
    const QuickAddCategory = component.ReportEditorCategories.find(
      (Category) => Category.CategoryName === '快速新增分類',
    )!;
    expect(component.ReportEditorDraft.CategoryId).toBe(
      QuickAddCategory.CategoryId,
    );
    expect(component.ReportEditorDraft.ReportName).toBe('保留中的上傳草稿');
    expect(component.ReportEditorDraft.Description).toBe(
      '保留中的上傳草稿說明',
    );
    expect(component.ReportEditorDraft.Enabled).toBeTrue();
    expect(component.SelectedReportFileName).toBe('DraftReport.rpt');
    expect(component.IsUploadReportDialogOpen).toBeTrue();
    expect(component.IsReportCategoryQuickAddOpen).toBeFalse();
    expect(component.SuccessToastMessage).toBe(
      '新增報表分類「快速新增分類」成功！',
    );

    component.OpenReportCategoryQuickAdd();
    component.QuickAddCategoryName = '取消的分類';
    component.CloseReportCategoryQuickAdd();
    expect(component.IsUploadReportDialogOpen).toBeTrue();
    expect(component.ReportEditorDraft.ReportName).toBe('保留中的上傳草稿');
    expect(component.ReportEditorDraft.Description).toBe(
      '保留中的上傳草稿說明',
    );
    expect(component.ReportEditorDraft.CategoryId).toBe(
      QuickAddCategory.CategoryId,
    );
    expect(component.ReportEditorDraft.Enabled).toBeTrue();
    expect(component.SelectedReportFileName).toBe('DraftReport.rpt');

    component.OpenEditReportDialog('AccountBalance');
    fixture.detectChanges();
    expect(Host.querySelector('.report-category-quick-add-trigger')).not.toBeNull();
    component.OpenReportCategoryQuickAdd();
    expect(component.IsReportCategoryQuickAddOpen).toBeTrue();
    component.CloseReportCategoryQuickAdd();

    Auth.Logout();
    expect(Auth.Login('warehouse@example.com', 'warehouse123')).toBeTrue();
    fixture.detectChanges();
    expect(Host.querySelector('.report-category-quick-add-trigger')).toBeNull();
    component.OpenReportCategoryQuickAdd();
    expect(component.IsReportCategoryQuickAddOpen).toBeFalse();
  });

  it('lets only a permitted front user manage report categories through the modal', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'RptManagement';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    const Host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    expect(
      Array.from(Host.querySelectorAll('button')).some(
        (Button) => Button.textContent?.trim() === '管理分類',
      ),
    ).toBeTrue();
    component.OpenCategoryManagementDialog();
    fixture.detectChanges();
    expect(Host.querySelector('.category-management-modal')).not.toBeNull();
    expect(Host.textContent).toContain('未分類');
    expect(Host.textContent).not.toContain('待分類 / 未分類');
    expect(component.CategoryManagementCategories.at(-1)?.CategoryId).toBe(
      'SYSTEM_UNCATEGORIZED',
    );
    const ReservedCategoryRow = Array.from(
      Host.querySelectorAll<HTMLElement>('.category-management-row'),
    ).at(-1)!;
    expect(
      ReservedCategoryRow.querySelector('.category-management-usage')
        ?.textContent,
    ).toContain('0 份報表使用中');
    expect(
      ReservedCategoryRow.querySelector(
        '.category-management-action-slot .category-system-reserved',
      )?.textContent,
    ).toContain('系統保留');
    expect(Host.querySelector('[title="編輯分類"]')?.textContent).toContain(
      '✎',
    );
    expect(Host.querySelector('[title="刪除分類"]')?.textContent).toContain(
      '🗑',
    );
    expect(
      Host.querySelectorAll(
        '.category-system-reserved ~ .category-management-actions',
      ).length,
    ).toBe(0);

    component.NewCategoryName = '   ';
    component.CreateManagedCategory();
    expect(component.CategoryCreateError).toBe('請輸入分類名稱。');
    component.NewCategoryName = '臨時分類';
    component.CreateManagedCategory();
    expect(
      component.CategoryManagementCategories.some(
        (Category) => Category.CategoryName === '臨時分類',
      ),
    ).toBeTrue();
    expect(component.CategoryManagementCategories.at(-1)?.CategoryId).toBe(
      'SYSTEM_UNCATEGORIZED',
    );
    expect(component.CategoryManagementCategories.at(-2)?.CategoryName).toBe(
      '臨時分類',
    );
    expect(component.SuccessToastMessage).toBe(
      '新增報表分類「臨時分類」成功！',
    );

    const TemporaryCategory = component.CategoryManagementCategories.find(
      (Category) => Category.CategoryName === '臨時分類',
    )!;
    component.StartCategoryEdit(TemporaryCategory);
    component.EditingCategoryName = '暫存分類';
    component.SaveCategoryEdit();
    expect(
      component.CategoryManagementCategories.some(
        (Category) => Category.CategoryName === '暫存分類',
      ),
    ).toBeTrue();

    const RenamedCategory = component.CategoryManagementCategories.find(
      (Category) => Category.CategoryName === '暫存分類',
    )!;
    component.OpenDeleteCategoryDialog(RenamedCategory.CategoryId);
    fixture.detectChanges();
    expect(Host.textContent).toContain('確定要刪除報表分類「暫存分類」嗎？');
    component.CloseDeleteCategoryDialog();
    expect(
      MockRbac.GetCategories().some(
        (Category) => Category.CategoryId === RenamedCategory.CategoryId,
      ),
    ).toBeTrue();
    component.OpenDeleteCategoryDialog(RenamedCategory.CategoryId);
    component.ConfirmDeleteCategory();
    expect(
      MockRbac.GetCategories().some(
        (Category) => Category.CategoryId === RenamedCategory.CategoryId,
      ),
    ).toBeFalse();

    const FinanceReportKeys = MockRbac.Reports.filter(
      (Report) => Report.CategoryId === 'FINANCE',
    ).map((Report) => Report.ReportKey);
    component.OpenDeleteCategoryDialog('FINANCE');
    fixture.detectChanges();
    expect(Host.textContent).toContain(
      '若刪除此分類，這些報表將自動移至「未分類」。',
    );
    component.ConfirmDeleteCategory();
    expect(
      FinanceReportKeys.every(
        (ReportKey) =>
          MockRbac.GetReport(ReportKey)?.CategoryId === 'SYSTEM_UNCATEGORIZED',
      ),
    ).toBeTrue();
    expect(component.SuccessToastMessage).toContain('2 份報表已移至「未分類」');

    const ReservedCategory = MockRbac.GetCategories().find(
      (Category) => Category.CategoryId === 'SYSTEM_UNCATEGORIZED',
    )!;
    component.StartCategoryEdit(ReservedCategory);
    component.OpenDeleteCategoryDialog(ReservedCategory.CategoryId);
    expect(component.EditingCategoryId).toBeNull();
    expect(component.DeletingCategory).toBeNull();

    component.CloseCategoryManagementDialog();
    Auth.Logout();
    expect(Auth.Login('warehouse@example.com', 'warehouse123')).toBeTrue();
    fixture.detectChanges();
    expect(
      Array.from(Host.querySelectorAll('button')).some(
        (Button) => Button.textContent?.trim() === '管理分類',
      ),
    ).toBeFalse();
    component.OpenCategoryManagementDialog();
    expect(component.IsCategoryManagementDialogOpen).toBeFalse();
  });

  it('keeps report management toggle DOM nodes when report search loses focus', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'RptManagement';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const Search = Host.querySelector<HTMLInputElement>(
      '#report-management-search',
    )!;
    const ToggleBeforeBlur = Host.querySelector<HTMLButtonElement>(
      '.report-management-table [role="switch"]',
    )!;
    const EnabledBeforeBlur = ToggleBeforeBlur.getAttribute('aria-checked');

    Search.focus();
    Search.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    const ToggleAfterBlur = Host.querySelector<HTMLButtonElement>(
      '.report-management-table [role="switch"]',
    );
    expect(ToggleAfterBlur).toBe(ToggleBeforeBlur);
    expect(ToggleAfterBlur?.getAttribute('aria-checked')).toBe(
      EnabledBeforeBlur,
    );
  });

  it('paginates the filtered report search list and resets to page one after search changes', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportParameter';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.ParameterReportTotalPages).toBe(2);
    expect(component.PagedParameterReports).toHaveSize(10);
    expect(
      fixture.nativeElement.querySelectorAll('.list-pagination button').length,
    ).toBe(4);

    component.NextParameterReportPage();
    expect(component.ParameterReportCurrentPage).toBe(2);
    expect(component.PagedParameterReports).toHaveSize(2);

    component.ParameterReportSearchText = 'Activity';
    component.OnParameterReportSearchChange();
    fixture.detectChanges();
    expect(component.ParameterReportCurrentPage).toBe(1);
    expect(component.PagedParameterReports).toHaveSize(2);
    expect(fixture.nativeElement.querySelector('.list-pagination')).toBeNull();
  });

  it('paginates the UserManagement table without paginating role cards', () => {
    const Auth = TestBed.inject(AuthService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();

    for (let Index = 0; Index < 3; Index++) TestBed.inject(MockRbacService).CreateUser({
      Account: 'pagination' + Index, DisplayName: '分頁測試', Roles: ['FINANCE'], Enabled: true,
    });
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.UserTotalPages).toBe(2);
    expect(component.PagedUsers).toHaveSize(10);
    expect(fixture.nativeElement.querySelectorAll('.role-card').length).toBe(
      component.MockRbac.Roles.length,
    );

    component.GoToUserPage(2);
    expect(component.PagedUsers).toHaveSize(2);
    component.SetUserRoleFilter('FINANCE');
    expect(component.UserCurrentPage).toBe(1);
    expect(component.PagedUsers.length).toBeLessThanOrEqual(10);
  });

  it('keeps ReportManagement pagination on valid pages after report deletion', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'RptManagement';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.GoToReportManagementPage(2);
    expect(component.ReportManagementCurrentPage).toBe(2);
    expect(component.PagedManagedReports).toHaveSize(3);

    for (let Index = 0; Index < 3; Index += 1) {
      const Report = component.PagedManagedReports[0];
      component.OpenDeleteReportDialog(Report.ReportKey);
      component.ConfirmDeleteReport();
    }

    expect(component.ReportManagementTotalPages).toBe(1);
    expect(component.ReportManagementCurrentPage).toBe(1);
    expect(component.PagedManagedReports).toHaveSize(10);
  });

  it('does not prefill a database password when an administrator edits a connection', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'DatabaseConnection';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.OpenEditDatabaseConnection(
      component.DatabaseConnections.Connections[0].Key,
    );
    fixture.detectChanges();

    const PasswordInput = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('#database-password');
    expect(PasswordInput?.value).toBe('');
    expect(PasswordInput?.placeholder).toBe('••••••••');
    expect(fixture.nativeElement.textContent).toContain(
      '若不修改密碼請保持空白。',
    );
  });

  it('uses localized category permission labels in the EditRole dialog', () => {
    const Auth = TestBed.inject(AuthService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.componentInstance.OpenEditRoleDialog('FINANCE');
    fixture.detectChanges();

    const Headers = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.role-permission-table th',
      ),
    ).map((Header) => Header.textContent?.trim());
    expect(Headers).toEqual(['報表分類', '預覽', '匯出', '列印']);
    expect(fixture.nativeElement.textContent).toContain('財務');
    expect(fixture.nativeElement.textContent).not.toContain('AccountBalance');
    expect(fixture.nativeElement.textContent).not.toContain('CanExecute');
    expect(fixture.nativeElement.textContent).not.toContain('CanExport');
    expect(fixture.nativeElement.textContent).not.toContain('CanPrint');
  });

  it('opens the export menu, closes it after selection, and shows the selected Mock format', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportPreview';
    expect(LoginFrontManager(Auth)).toBeTrue();

    Auth.SelectReport('AccountBalance');
    const fixture = TestBed.createComponent(DemoPortalComponent);
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const Trigger = Host.querySelector<HTMLButtonElement>(
      '[aria-haspopup="menu"]',
    )!;
    expect(Trigger.textContent).toContain('匯出');
    expect(Trigger.getAttribute('aria-expanded')).toBe('false');

    Trigger.click();
    fixture.detectChanges();
    expect(Trigger.getAttribute('aria-expanded')).toBe('true');
    expect(
      Array.from(Host.querySelectorAll('[role="menuitem"]')).map((Item) =>
        Item.textContent?.trim(),
      ),
    ).toEqual(['PDF', 'Excel', 'Word', 'CSV', 'RTF', '文字檔']);

    document.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(Host.querySelector('[role="menu"]')).toBeNull();

    Trigger.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(Host.querySelector('[role="menu"]')).toBeNull();

    Trigger.click();
    fixture.detectChanges();

    Host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1].click();
    fixture.detectChanges();
    expect(Host.querySelector('[role="menu"]')).toBeNull();
    expect(Host.querySelector('.mock-notice')?.textContent).toContain(
      'Excel 匯出目前為前端 Mock 操作',
    );
  });

  it('renders the selected report definition and automatically synchronizes an invalid date range', () => {
    const Auth = TestBed.inject(AuthService);
    const RouterService = TestBed.inject(Router);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    Route.snapshot.data.Page = 'ReportParameter';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.SelectReportForParameters('AccountBalance');
    fixture.detectChanges();

    expect(
      component.VisibleReportParameters.map(
        (Definition) => Definition.ParameterName,
      ),
    ).toEqual(['PostingDate', 'CustomerCode']);
    expect(fixture.nativeElement.textContent).not.toContain('UserCode@');

    const PostingDate = component.ReportParameterForm.get(
      'PostingDate',
    ) as unknown as FormGroup;
    PostingDate.get('Start')!.setValue('2026-08-30');
    PostingDate.get('End')!.setValue('2026-08-31');
    component.OnRangeValueChange(component.VisibleReportParameters[0]);
    expect(PostingDate.get('End')!.value).toBe('2026-08-31');

    PostingDate.get('End')!.setValue('2026-08-29');
    component.OnRangeValueChange(component.VisibleReportParameters[0]);
    expect(PostingDate.get('End')!.value).toBe('2026-08-30');
    expect(component.ParameterRangeErrors['PostingDate']).toBe(
      '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。',
    );

    PostingDate.get('End')!.setValue('2026-09-02');
    component.OnRangeValueChange(component.VisibleReportParameters[0]);
    expect(component.ParameterRangeErrors['PostingDate']).toBeUndefined();
    component.ExecuteReport();
    expect(Navigate).toHaveBeenCalledWith(['/reports/preview']);
  });

  it('renders the complete Activity input-type set with typed defaults', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportParameter';
    expect(LoginFrontManager(Auth)).toBeTrue();
    Auth.SelectReport('Activity');

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.SelectReportForParameters('Activity');
    fixture.detectChanges();

    expect(
      component.VisibleReportParameters.map(
        (Definition) => Definition.DisplayName,
      ),
    ).toEqual([
      '活動時間',
      '關鍵字',
      '備註',
      '筆數上限',
      '最小金額',
      '包含停用項目',
    ]);
    expect(component.ReportParameterForm.get('ResultLimit')!.value).toBe(100);
    expect(component.ReportParameterForm.get('MinimumAmount')!.value).toBe(0.5);
    expect(
      component.ReportParameterForm.get('IncludeInactive')!.value,
    ).toBeFalse();

    const Host = fixture.nativeElement as HTMLElement;
    expect(Host.querySelector('input[type="datetime-local"]')).not.toBeNull();
    expect(Host.querySelector('textarea')).not.toBeNull();
    expect(Host.querySelectorAll('input[type="number"]').length).toBe(2);
    expect(Host.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('blocks invalid generation, supports multi-select, and validates a numeric range', () => {
    const Auth = TestBed.inject(AuthService);
    const RouterService = TestBed.inject(Router);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    const Navigate = spyOn(RouterService, 'navigate').and.resolveTo(true);
    Route.snapshot.data.Page = 'ReportParameter';
    expect(LoginFrontManager(Auth)).toBeTrue();
    Auth.SelectReport('InventoryTransferHana');

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.SelectReportForParameters('InventoryTransferHana');
    fixture.detectChanges();

    expect(component.CanGenerateReport).toBeFalse();
    component.ExecuteReport();
    expect(Navigate).not.toHaveBeenCalled();

    (
      component.ReportParameterForm.get('ItemCodes') as unknown as FormControl<
        string[]
      >
    ).setValue(['A-100', 'B-200']);
    const Quantity = component.ReportParameterForm.get(
      'Quantity',
    ) as unknown as FormGroup;
    Quantity.get('Start')!.setValue(10);
    Quantity.get('End')!.setValue(10);
    expect(component.CanGenerateReport).toBeTrue();

    Quantity.get('End')!.setValue(9);
    expect(component.CanGenerateReport).toBeFalse();
    expect(Quantity.hasError('range')).toBeTrue();

    Quantity.get('End')!.setValue(10);
    component.ExecuteReport();
    expect(Navigate).toHaveBeenCalledWith(['/reports/preview']);
    expect(component.LastMockExecutionParameters?.['ItemCodes']).toEqual([
      'A-100',
      'B-200',
    ]);
    expect(component.LastMockExecutionParameters?.['Quantity']).toEqual({
      Start: 10,
      End: 10,
    });
  });

  it('renders SQL LOV loading, empty, error, and retry states without rendering UserCode@', () => {
    const Auth = TestBed.inject(AuthService);
    const ParameterService = TestBed.inject(MockReportParameterService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportParameter';
    expect(LoginFrontManager(Auth)).toBeTrue();
    Auth.SelectReport('AccountBalance');

    ParameterService.SetLovStatus('AccountBalance', 'CustomerCode', 'loading');
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.SelectReportForParameters('AccountBalance');
    fixture.detectChanges();
    const Host = fixture.nativeElement as HTMLElement;
    expect(Host.textContent).toContain('載入選項中…');
    expect(Host.textContent).not.toContain('UserCode@');

    ParameterService.SetLovStatus('AccountBalance', 'CustomerCode', 'empty');
    fixture.detectChanges();
    expect(Host.textContent).toContain('目前無可選項。');

    ParameterService.SetLovStatus('AccountBalance', 'CustomerCode', 'error');
    fixture.detectChanges();
    expect(Host.textContent).toContain('無法載入選項，請重試。');
    component.RetryLov(component.VisibleReportParameters[1]);
    fixture.detectChanges();
    expect(Host.textContent).not.toContain('無法載入選項，請重試。');
    expect(
      ParameterService.GetLovStatus('AccountBalance', 'CustomerCode'),
    ).toBe('success');
  });

  it('keeps the EditUser modal open and clears the local required-role error after a role change', () => {
    const Auth = TestBed.inject(AuthService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    component.EditUser('user@example.com');
    component.EditingUser!.Roles = [];
    component.SaveEditedUser();
    fixture.detectChanges();

    expect(component.EditingUser).not.toBeNull();
    expect(component.EditUserValidationErrors.Roles).toBe(
      '請至少選擇一個角色。',
    );
    expect(component.ManagementNotice).toBe('');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.edit-user-modal #edit-user-roles-error',
      )?.textContent,
    ).toContain('請至少選擇一個角色。');

    component.ToggleEditingUserRole('FINANCE', true);

    expect(component.EditUserValidationErrors.Roles).toBeUndefined();
  });

  it('keeps the database connection modal open and renders required-field errors locally', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'DatabaseConnection';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    component.OpenCreateDatabaseConnection();
    component.SaveDatabaseConnection();
    fixture.detectChanges();

    expect(component.IsDatabaseConnectionEditorOpen).toBeTrue();
    expect(component.DatabaseConnectionFormError).toBe(
      '建立連線時請填寫資料來源、主機、連接埠、資料庫、帳號與密碼。',
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.database-connection-modal .field-error',
      )?.textContent,
    ).toContain(component.DatabaseConnectionFormError);

    component.CloseDatabaseConnectionEditor();
    expect(component.DatabaseConnectionFormError).toBe('');
  });

  it('creates a role from the UserManagement dialog state and makes it available in role cards', () => {
    const Auth = TestBed.inject(AuthService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenCreateRoleDialog();
    expect(
      component.RoleDraft.Permissions.map((Entry) => Entry.CategoryId),
    ).toContain('MARKETING');
    expect(
      component.RoleDraft.Permissions.map((Entry) => Entry.CategoryId),
    ).not.toContain('SYSTEM_UNCATEGORIZED');
    component.RoleDraft.DisplayName = '業務人員';
    component.RoleDraft.Permissions[0].Permission.CanExecute = true;
    component.SaveRole();
    fixture.detectChanges();

    expect(component.IsCreateRoleDialogOpen).toBeFalse();
    expect(component.SuccessToastMessage).toBe('新增角色「業務人員」，成功！');
    expect(fixture.nativeElement.textContent).toContain('業務人員');
    expect(component.MockRbac.Roles.find((Role) => Role.DisplayName === '業務人員')?.Description).toBe(
      '前端 Mock 建立的自訂角色。',
    );
    expect(
      fixture.nativeElement.querySelectorAll('.role-filter-tabs button').length,
    ).toBe(component.MockRbac.Roles.length + 1);
  });

  it('edits an existing role from the UserManagement dialog state', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenEditRoleDialog('FINANCE');
    component.RoleDraft.DisplayName = '財務分析人員';
    component.RoleDraft.Permissions[1].Permission.CanExecute = true;
    component.SaveEditedRole();
    fixture.detectChanges();

    expect(component.IsEditRoleDialogOpen).toBeFalse();
    expect(component.SuccessToastMessage).toBe('角色「財務分析人員」已更新。');
    expect(MockRbac.GetRole('FINANCE').DisplayName).toBe('財務分析人員');
  });

  it('cancels custom role renames and deletes a zero-user role only after confirmation', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenCreateRoleDialog();
    component.RoleDraft.DisplayName = 'admin123';
    component.RoleDraft.ManagementPermissions = ['RptManagement'];
    component.SaveRole();
    const RoleKey = MockRbac.Roles.find(
      (Role) => Role.DisplayName === 'admin123',
    )!.Key;

    component.OpenEditRoleDialog(RoleKey);
    component.RoleDraft.DisplayName = '取消後不應套用';
    component.CloseEditRoleDialog();
    expect(MockRbac.GetRole(RoleKey).DisplayName).toBe('admin123');

    component.OpenEditRoleDialog(RoleKey);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
        '.role-name-field input',
      )!.readOnly,
    ).toBeFalse();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[aria-label="刪除角色"]',
      ),
    ).not.toBeNull();

    component.OpenDeleteRoleDialog();
    expect(component.DeletingRole?.Key).toBe(RoleKey);
    component.ConfirmDeleteRole();
    expect(MockRbac.Roles.some((Role) => Role.Key === RoleKey)).toBeFalse();
    expect(component.SuccessToastMessage).toBe('角色「admin123」已刪除。');
  });

  it('blocks deletion of a role that is still assigned to users', () => {
    const Auth = TestBed.inject(AuthService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenEditRoleDialog('FINANCE');
    component.OpenDeleteRoleDialog();

    expect(component.DeletingRole).toBeNull();
    expect(component.RoleDraftError).toContain('此角色仍有使用者使用');
  });

  it('derives role filter tabs and user counts from the current Mock data', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const RoleTabButtons = fixture.nativeElement.querySelectorAll(
      '.role-filter-tabs button',
    );
    expect(RoleTabButtons.length).toBe(MockRbac.Roles.length + 1);

    const Role = MockRbac.Roles[0];
    const RoleUsers = MockRbac.Users.filter((User) =>
      User.Roles.includes(Role.Key),
    );
    component.SetUserRoleFilter(Role.Key);
    expect(component.FilteredUsers).toEqual(RoleUsers);

    component.UserSearchText = RoleUsers[0].Account;
    expect(component.FilteredUsers).toEqual([RoleUsers[0]]);

    component.SetUserRoleFilter(null);
    expect(component.FilteredUsers).toEqual([RoleUsers[0]]);
  });

  it('supports ordinary multi-role assignment', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenCreateUserDialog();
    component.UserDraft.Account = 'role-flow@example.com';
    component.UserDraft.DisplayName = '角色流程測試';
    component.UserDraft.Roles = [];
    component.ToggleUserRole(component.UserDraft, 'PURCHASE', true);
    component.SaveUser();
    expect(MockRbac.GetUser('role-flow@example.com')?.Roles).toEqual([
      'PURCHASE',
    ]);

    component.EditUser('role-flow@example.com');
    component.ToggleUserRole(component.EditingUser!, 'WAREHOUSE', true);
    component.SaveEditedUser();
    expect(MockRbac.GetUser('role-flow@example.com')?.Roles).toEqual([
      'PURCHASE',
      'WAREHOUSE',
    ]);

    component.EditUser('role-flow@example.com');
    expect(MockRbac.Roles.some((Role) => Role.Key === 'ADMIN')).toBeFalse();
  });

  it('uses the CreateUser checkbox group for multi-role selection, and field-level validation', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    component.OpenCreateUserDialog();
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const CreateRoleOption = (RoleKey: string) => {
      const RoleName = MockRbac.GetRole(RoleKey)!.DisplayName;
      return Array.from(
        Host.querySelectorAll<HTMLLabelElement>('.create-user-role-option'),
      ).find((Entry) => Entry.textContent?.includes(RoleName))!;
    };
    const CreateRoleCheckbox = (RoleKey: string) => {
      return CreateRoleOption(RoleKey).querySelector<HTMLInputElement>('input')!;
    };
    expect(Host.querySelector('.create-user-modal')).not.toBeNull();
    expect(
      Host.querySelectorAll('.create-user-identity-fields input').length,
    ).toBe(2);
    expect(component.UserDraft.Enabled).toBeFalse();

    component.SaveUser();
    expect(component.CreateUserValidationErrors).toEqual({
      Account: '請輸入使用者帳號。',
      DisplayName: '請輸入使用者名稱。',
      Roles: '請至少選擇一個角色。',
    });

    CreateRoleOption('FINANCE').querySelector('span')!.click();
    fixture.detectChanges();
    expect(component.UserDraft.Roles).toEqual(['FINANCE']);
    CreateRoleCheckbox('PURCHASE').click();
    fixture.detectChanges();
    CreateRoleOption('WAREHOUSE').click();
    fixture.detectChanges();
    expect(component.UserDraft.Roles).toEqual([
      'FINANCE',
      'PURCHASE',
      'WAREHOUSE',
    ]);

    CreateRoleCheckbox('FINANCE').click();
    CreateRoleCheckbox('PURCHASE').click();
    CreateRoleCheckbox('WAREHOUSE').click();
    component.UserDraft.Account = 'created-multi-role@example.com';
    component.UserDraft.DisplayName = '多角色建立測試';
    CreateRoleCheckbox('PURCHASE').click();
    fixture.detectChanges();
    CreateRoleCheckbox('WAREHOUSE').click();
    fixture.detectChanges();
    component.SaveUser();
    expect(MockRbac.GetUser('created-multi-role@example.com')?.Roles).toEqual([
      'PURCHASE',
      'WAREHOUSE',
    ]);
  });

  it('shows the backend-generated one-time credentials without a password field after user creation', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    component.OpenCreateUserDialog();
    component.UserDraft.Account = 'created-credentials@example.com';
    component.UserDraft.DisplayName = '帳密結果測試';
    component.ToggleCreateUserRole('FINANCE', true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('input[name="create-user-password"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('初始密碼將由後端隨機產生');

    component.SaveUser();
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    expect(component.IsCreateUserDialogOpen).toBeFalse();
    expect(component.CreatedUserCredentials?.Account).toBe('created-credentials@example.com');
    expect(component.CreatedUserCredentials?.InitialPassword).toMatch(/^[A-Za-z0-9!@#$%]{16}$/);
    expect(MockRbac.GetUser('created-credentials@example.com')).not.toBeNull();
    expect(
      Host.querySelector('.created-user-success-modal')?.textContent,
    ).toContain('created-credentials@example.com');
    expect(
      Host.querySelector('#created-user-success-description')?.textContent,
    ).toContain('已成功建立使用者。');
    expect(
      Host.querySelector('#created-user-success-description strong')?.textContent,
    ).toContain('首次登入時立即修改密碼');
    expect(
      Host.querySelector('.created-user-password-row dt')?.textContent?.trim(),
    ).toBe('初始密碼：');
    expect(Host.querySelector('.created-user-copy-button')).not.toBeNull();

    component.CloseCreatedUserSuccessModal();
    expect(component.CreatedUserCredentials).toBeNull();
  });

  it('clears and disables output permissions when CanExecute is removed', () => {
    LoginBoundBackOfficeOperator(TestBed.inject(AuthService));
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    const Entry = component.RoleDraft.Permissions[0];
    Entry.Permission.CanExport = true;
    Entry.Permission.CanPrint = true;

    component.SetPermissionCanExecute(Entry, false);

    expect(Entry.Permission).toEqual({
      CanExecute: false,
      CanExport: false,
      CanPrint: false,
    });
  });

  it('shows carousel navigation only when the role cards overflow their viewport', () => {
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    const Viewport = {
      clientWidth: 300,
      scrollWidth: 900,
      scrollLeft: 0,
    } as HTMLElement;
    const ComponentWithViewport = component as unknown as {
      roleCardViewport: { nativeElement: HTMLElement };
    };
    ComponentWithViewport.roleCardViewport = { nativeElement: Viewport };

    Object.defineProperty(Viewport, 'scrollWidth', {
      configurable: true,
      value: 300,
    });
    component.UpdateRoleCardNavigation();
    expect(component.RoleCardHasOverflow).toBeFalse();
    expect(component.CanScrollRoleCardsLeft).toBeFalse();
    expect(component.CanScrollRoleCardsRight).toBeFalse();
    expect(component.IsRoleCardAtStart).toBeTrue();
    expect(component.IsRoleCardAtEnd).toBeTrue();

    Object.defineProperty(Viewport, 'scrollWidth', {
      configurable: true,
      value: 900,
    });
    component.UpdateRoleCardNavigation();
    expect(component.RoleCardHasOverflow).toBeTrue();
    expect(component.CanScrollRoleCardsLeft).toBeFalse();
    expect(component.CanScrollRoleCardsRight).toBeTrue();
    expect(component.IsRoleCardAtStart).toBeTrue();
    expect(component.IsRoleCardAtEnd).toBeFalse();

    Object.defineProperty(Viewport, 'scrollLeft', {
      configurable: true,
      value: 300,
      writable: true,
    });
    component.UpdateRoleCardNavigation();
    expect(component.CanScrollRoleCardsLeft).toBeTrue();
    expect(component.CanScrollRoleCardsRight).toBeTrue();

    Viewport.scrollLeft = 600;
    component.UpdateRoleCardNavigation();
    expect(component.CanScrollRoleCardsLeft).toBeTrue();
    expect(component.CanScrollRoleCardsRight).toBeFalse();
    expect(component.IsRoleCardAtEnd).toBeTrue();

    Object.defineProperty(Viewport, 'scrollWidth', {
      configurable: true,
      value: 300,
    });
    component.UpdateRoleCardNavigation();
    expect(Viewport.scrollLeft).toBe(0);
    expect(component.RoleCardHasOverflow).toBeFalse();
    expect(component.CanScrollRoleCardsLeft).toBeFalse();
    expect(component.CanScrollRoleCardsRight).toBeFalse();
  });

  it('keeps the create actions in their section headers rather than in role cards or search', () => {
    const Auth = TestBed.inject(AuthService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const RoleSection = Host.querySelector(
      '[aria-labelledby="role-management-title"]',
    )!;
    const UserSection = Host.querySelector(
      '[aria-labelledby="user-management-title"]',
    )!;
    const RoleCreateAction = RoleSection.querySelector<HTMLButtonElement>(
      '.management-card-heading button',
    )!;
    const UserCreateAction = UserSection.querySelector<HTMLButtonElement>(
      '.management-card-heading button',
    )!;

    expect(
      RoleSection.querySelector('.role-card-grid .section-header-action'),
    ).toBeNull();
    expect(
      UserSection.querySelector(
        '.user-management-toolbar .section-header-action',
      ),
    ).toBeNull();
    expect(
      RoleSection.querySelectorAll('.role-card > p:not(.role-card-count)'),
    ).toHaveSize(0);

    RoleCreateAction.click();
    expect(component.IsCreateRoleDialogOpen).toBeTrue();
    component.CloseCreateRoleDialog();

    UserCreateAction.click();
    expect(component.IsCreateUserDialogOpen).toBeTrue();
  });

  it('requires a unique role name and at least one permission before creating a role', () => {
    const Auth = TestBed.inject(AuthService);
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;

    component.OpenCreateRoleDialog();
    component.SaveRole();
    expect(component.RoleDraftError).toBe('請輸入角色名稱。');

    component.RoleDraft.DisplayName = '財務人員';
    component.SaveRole();
    expect(component.RoleDraftError).toBe(
      '角色名稱已存在，請輸入未重複的角色名稱。',
    );

    component.RoleDraft.DisplayName = '稽核人員';
    component.SaveRole();
    expect(component.RoleDraftError).toBe('請至少勾選一個權限。');

    component.RoleDraft.Permissions[0].Permission.CanExecute = true;
    component.SaveRole();
    expect(component.IsCreateRoleDialogOpen).toBeFalse();
  });

  it('filters front-office notifications between all and unread tabs', () => {
    const Auth = TestBed.inject(AuthService);
    const NotificationCenter = TestBed.inject(MockNotificationCenterService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'NotificationCenter';
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();
    NotificationCenter.NotifyRoleAssignmentChange(
      'user@example.com',
      NotificationCenter.CaptureAccess('user@example.com'),
    );

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('全部（1）');
    expect(fixture.nativeElement.textContent).toContain('未讀（1）');
    expect(component.DisplayedNotifications).toHaveSize(1);
    component.NotificationCenterTab = 'Unread';
    component.MarkCenterNotificationRead(
      component.CurrentNotifications[0].Id,
    );
    expect(component.DisplayedNotifications).toHaveSize(0);
    component.NotificationCenterTab = 'All';
    expect(component.DisplayedNotifications).toHaveSize(1);

    component.ToggleNotificationPanel();
    expect(
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll(
          '.notification-popover-tabs button',
        ),
      ).map((Button) => Button.textContent?.trim()),
    ).toEqual(['全部（1）', '未讀（0）']);

    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();
    const BackOfficeFixture = TestBed.createComponent(DemoPortalComponent);
    BackOfficeFixture.detectChanges();
    const BackOfficeComponent = BackOfficeFixture.componentInstance;
    expect(BackOfficeComponent.NotificationCenterTab).toBe('All');
    expect(
      Array.from(
        (BackOfficeFixture.nativeElement as HTMLElement).querySelectorAll(
          '.notification-center-tabs button',
        ),
      ).map((Button) => Button.textContent?.trim()),
    ).toEqual(['全部（0）', '未讀（0）']);
    BackOfficeComponent.ToggleNotificationPanel();
    expect(
      Array.from(
        (BackOfficeFixture.nativeElement as HTMLElement).querySelectorAll(
          '.notification-popover-tabs button',
        ),
      ).map((Button) => Button.textContent?.trim()),
    ).toEqual(['全部（0）', '未讀（0）']);
  });

  it('opens a report from list rows while favorite controls do not bubble', () => {
    const Auth = TestBed.inject(AuthService);
    const MockRbac = TestBed.inject(MockRbacService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'ReportList';
    expect(Auth.Login('user@example.com', 'user123')).toBeTrue();
    MockRbac.ToggleFavoriteReport('user@example.com', 'AccountBalance');

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    const SelectReport = spyOn(component, 'SelectReportByKey');
    fixture.detectChanges();
    const Host = fixture.nativeElement as HTMLElement;

    Host.querySelector<HTMLTableRowElement>('.favorite-report-table tbody tr')!.click();
    expect(SelectReport).toHaveBeenCalledWith('AccountBalance');
    SelectReport.calls.reset();
    Host.querySelector<HTMLButtonElement>('.favorite-star-button')!.click();
    expect(SelectReport).not.toHaveBeenCalled();
  });

  it('opens all-report rows and report-management editors while controls do not bubble', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    expect(LoginFrontManager(Auth)).toBeTrue();

    Route.snapshot.data.Page = 'ReportParameter';
    const ParameterFixture = TestBed.createComponent(DemoPortalComponent);
    const ParameterComponent = ParameterFixture.componentInstance;
    const SelectParameterReport = spyOn(ParameterComponent, 'SelectReportForPreview');
    ParameterFixture.detectChanges();
    const ParameterHost = ParameterFixture.nativeElement as HTMLElement;
    ParameterHost.querySelector<HTMLTableRowElement>('.parameter-report-table tbody tr')!.click();
    expect(SelectParameterReport).toHaveBeenCalled();
    SelectParameterReport.calls.reset();
    ParameterHost.querySelector<HTMLButtonElement>('.parameter-favorite-button')!.click();
    expect(SelectParameterReport).not.toHaveBeenCalled();

    Route.snapshot.data.Page = 'RptManagement';
    const ManagementFixture = TestBed.createComponent(DemoPortalComponent);
    const ManagementComponent = ManagementFixture.componentInstance;
    const OpenManagedReportEditor = spyOn(
      ManagementComponent,
      'OpenEditReportDialog',
    );
    ManagementFixture.detectChanges();
    const ManagementHost = ManagementFixture.nativeElement as HTMLElement;
    ManagementHost.querySelector<HTMLTableRowElement>('.report-management-table tbody tr')!.click();
    expect(OpenManagedReportEditor).toHaveBeenCalledWith(
      ManagementComponent.PagedManagedReports[0].ReportKey,
    );
    OpenManagedReportEditor.calls.reset();
    ManagementHost.querySelector<HTMLButtonElement>('.report-management-pin-button')!.click();
    expect(OpenManagedReportEditor).not.toHaveBeenCalled();
  });

  it('opens user editors from user-management rows while row controls do not bubble', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: { Page: string } };
    };
    Route.snapshot.data.Page = 'UserManagement';
    expect(LoginBoundBackOfficeOperator(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    const EditUser = spyOn(component, 'EditUser');
    fixture.detectChanges();

    const Host = fixture.nativeElement as HTMLElement;
    const FirstUser = component.PagedUsers[0];
    Host.querySelector<HTMLTableRowElement>(
      '.user-management-table tbody tr',
    )!.click();
    expect(EditUser).toHaveBeenCalledWith(FirstUser.Account);

    EditUser.calls.reset();
    Host.querySelector<HTMLButtonElement>(
      '.user-management-table [role="switch"]',
    )!.click();
    expect(EditUser).not.toHaveBeenCalled();

    Host.querySelector<HTMLButtonElement>(
      '.user-management-table .secondary-button',
    )!.click();
    expect(EditUser).toHaveBeenCalledOnceWith(FirstUser.Account);
  });

  it('renders paged operation logs, resets pagination on filtering, and opens a detail modal', () => {
    const Auth = TestBed.inject(AuthService);
    const Route = TestBed.inject(ActivatedRoute);
    Route.snapshot.data['Page'] = 'OperationLog';
    expect(LoginFrontManager(Auth)).toBeTrue();

    const fixture = TestBed.createComponent(DemoPortalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.FilteredOperationLogs).toHaveSize(11);
    expect(component.PagedOperationLogs).toHaveSize(10);
    expect(component.OperationLogTotalPages).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.operation-log-table tbody tr')).toHaveSize(10);

    component.GoToOperationLogPage(2);
    expect(component.PagedOperationLogs).toHaveSize(1);
    component.OperationLogCategoryFilter = 'ReportAction';
    component.OnOperationLogFilterChange();
    expect(component.OperationLogCurrentPage).toBe(1);
    expect(component.PagedOperationLogs.every((Entry) => Entry.Category === 'ReportAction')).toBeTrue();

    component.OperationLogCurrentPage = 2;
    component.OperationLogSourceFilter = 'BackOffice';
    component.OnOperationLogSourceChange();
    fixture.detectChanges();
    expect(component.OperationLogCategoryFilter).toBe('ALL');
    expect(component.OperationLogCurrentPage).toBe(1);
    const CategorySelect = fixture.nativeElement.querySelectorAll(
      '.operation-log-filters select',
    )[1] as HTMLSelectElement;
    const CategoryOptions = Array.from(CategorySelect.options).map((Option) => Option.value);
    expect(CategoryOptions).toEqual(['ALL', 'PermissionChange', 'AccountManagement']);

    component.OperationLogCategoryFilter = 'AccountManagement';
    component.OperationLogCurrentPage = 2;
    component.OperationLogSourceFilter = 'FrontOffice';
    component.OnOperationLogSourceChange();
    fixture.detectChanges();
    expect(component.OperationLogCategoryFilter).toBe('ALL');
    expect(component.OperationLogCurrentPage).toBe(1);
    expect(Array.from(CategorySelect.options).map((Option) => Option.value))
      .toEqual(['ALL', 'ReportAction']);

    component.OperationLogCategoryFilter = 'ALL';
    component.OperationLogSourceFilter = 'ALL';
    component.OnOperationLogFilterChange();
    component.ToggleOperationLogSort('UserId');
    expect(component.OperationLogSortDirection).toBe('asc');
    expect(component.PagedOperationLogs.map((Entry) => Entry.UserId)).toEqual(
      [...component.PagedOperationLogs.map((Entry) => Entry.UserId)].sort((Left, Right) =>
        Left.localeCompare(Right, 'zh-Hant'),
      ),
    );
    component.ToggleOperationLogSort('OccurredAt');
    expect(component.OperationLogSortDirection).toBe('asc');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.operation-log-table th[aria-sort]')).toHaveSize(2);

    (fixture.nativeElement.querySelector('.operation-log-row') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.operation-log-detail-modal')?.textContent)
      .toContain('操作紀錄細節');
    component.CloseOperationLogDetail();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.operation-log-detail-action button') as HTMLButtonElement).click();
    expect(component.SelectedOperationLog).not.toBeNull();
    component.CloseOperationLogDetail();
    expect(component.SelectedOperationLog).toBeNull();
  });
});
