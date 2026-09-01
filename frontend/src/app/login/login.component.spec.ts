import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { routes } from '../app.routes';
import { NotificationService } from '../services/notification.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('shows accessible required-field errors after an empty submit', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('#account-error')?.textContent,
    ).toContain('請輸入帳號');
    expect(
      fixture.nativeElement.querySelector('#password-error')?.textContent,
    ).toContain('請輸入密碼');
    expect(
      fixture.nativeElement
        .querySelector('#account')
        ?.getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('toggles password visibility without changing the value', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.password.setValue('not-a-real-password');

    component.togglePassword();

    expect(component.passwordVisible).toBeTrue();
    expect(component.password.value).toBe('not-a-real-password');
  });

  it('shows login status messages in a modal instead of moving the form', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.notice = 'credential-error';
    fixture.detectChanges();

    const Modal = fixture.nativeElement.querySelector('.notification-modal--error');
    expect(Modal?.getAttribute('role')).toBe('alertdialog');
    expect(Modal?.textContent).toContain('登入提示');
  });

  it('shows only the two localized Demo account references', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const DemoAccounts = fixture.nativeElement.querySelector(
      '.demo-accounts',
    ) as HTMLElement;
    expect(DemoAccounts.querySelectorAll('tbody tr').length).toBe(2);
    expect(DemoAccounts.textContent).toContain('user@example.com');
    expect(DemoAccounts.textContent).toContain('user123');
    expect(DemoAccounts.textContent).toContain('一般使用者');
    expect(DemoAccounts.textContent).toContain('admin@example.com');
    expect(DemoAccounts.textContent).toContain('admin123');
    expect(DemoAccounts.textContent).toContain('系統管理員');
    expect(DemoAccounts.textContent).not.toContain('FINANCE');
    expect(DemoAccounts.textContent).not.toContain('ADMIN');
    expect(DemoAccounts.textContent).not.toContain('admin2@example.com');
    expect(DemoAccounts.textContent).not.toContain('purchase-warehouse@example.com');
  });

  it('renders one full-height Login header without the compact breadcrumb row', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const Header = fixture.nativeElement.querySelector('.login-header') as HTMLElement;
    expect(Header.querySelector('.login-breadcrumb')).toBeNull();
    expect(Header.querySelector('.login-brand-mark')?.textContent).toContain('CR');
    expect(Header.querySelector('.login-brand strong')?.textContent).toContain(
      'Crystal Reports 外部報表系統',
    );
    expect(Header.querySelector('.login-support')?.textContent).toContain('系統支援');
  });

  it('navigates a MEMBER demo account to ReportList', fakeAsync(() => {
    const fixture = TestBed.createComponent(LoginComponent);
    const router = TestBed.inject(Router);
    const Notifications = TestBed.inject(NotificationService);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    const component = fixture.componentInstance;
    component.account.setValue('user@example.com');
    component.password.setValue('user123');

    component.submit();
    expect(component.isSubmitting).toBeTrue();
    expect(component.loginForm.disabled).toBeTrue();

    tick(700);
    expect(navigateSpy).toHaveBeenCalledWith(['/reports']);
    expect(Notifications.SuccessMessage).toBe('登入成功！');
    expect(component.loginForm.enabled).toBeTrue();
  }));

  it('navigates an ADMIN demo account to ReportList', fakeAsync(() => {
    const fixture = TestBed.createComponent(LoginComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    const component = fixture.componentInstance;
    component.account.setValue('admin@example.com');
    component.password.setValue('admin123');

    component.submit();
    tick(700);

    expect(navigateSpy).toHaveBeenCalledWith(['/reports']);
  }));

  it('rejects an account outside the local Demo list', fakeAsync(() => {
    const fixture = TestBed.createComponent(LoginComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    const component = fixture.componentInstance;
    component.account.setValue('unknown@example.com');
    component.password.setValue('incorrect');

    component.submit();
    tick(700);

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.noticeMessage).toContain('帳號或密碼錯誤');
    expect(component.loginForm.enabled).toBeTrue();
  }));
});
