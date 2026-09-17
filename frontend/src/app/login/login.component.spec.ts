import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { routes } from '../app.routes';
import { API_BASE_URL } from '../services/api.config';
import { LoginResponse } from '../services/auth-api.models';
import { NotificationService } from '../services/notification.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let http: HttpTestingController;

  const financeLoginResponse: LoginResponse = {
    success: true,
    message: '登入成功',
    passwordExpired: false,
    token: 'finance-jwt-token',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: {
      userId: 2,
      account: 'user@example.com',
      employeeNo: 'FIN001',
      userName: '財務測試使用者',
      roles: ['FINANCE'],
      permissions: [],
    },
  };

  beforeEach(async () => {
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('shows accessible required-field errors after an empty submit', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#account-error')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#password-error')).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('#account')
        ?.getAttribute('aria-invalid'),
    ).toBe('true');
    expect(http.match(() => true).length).toBe(0);
  });

  it('toggles password visibility without changing the value', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.password.setValue('not-a-real-password');

    component.togglePassword();

    expect(component.passwordVisible).toBeTrue();
    expect(component.password.value).toBe('not-a-real-password');
  });

  it('shows a credential error in the existing modal', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.notice = 'credential-error';
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector(
      '.notification-modal--error',
    ) as HTMLElement | null;

    expect(modal).not.toBeNull();
    expect(modal?.getAttribute('role')).toBe('alertdialog');
    expect(component.noticeMessage.length).toBeGreaterThan(0);
  });

  it('renders the full-height login header', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector(
      '.login-header',
    ) as HTMLElement;

    expect(header).not.toBeNull();
    expect(header.querySelector('.login-breadcrumb')).toBeNull();
    expect(header.querySelector('.login-brand-mark')?.textContent).toContain(
      'CR',
    );
    expect(header.querySelector('.login-brand strong')?.textContent).toContain(
      'Crystal Reports',
    );
  });

  it('logs in through the API and navigates to the report parameter page', fakeAsync(() => {
    const fixture = TestBed.createComponent(LoginComponent);
    const router = TestBed.inject(Router);
    const notifications = TestBed.inject(NotificationService);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    const component = fixture.componentInstance;

    component.account.setValue('user@example.com');
    component.password.setValue('user123');
    component.submit();

    expect(component.isSubmitting).toBeTrue();
    expect(component.loginForm.disabled).toBeTrue();

    const request = http.expectOne(`${API_BASE_URL}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      account: 'user@example.com',
      password: 'user123',
    });
    request.flush(financeLoginResponse);
    tick();

    expect(navigateSpy).toHaveBeenCalledWith(['/reports/parameters']);
    expect(notifications.SuccessMessage).toBeTruthy();
    expect(component.loginForm.enabled).toBeTrue();
    expect(component.isSubmitting).toBeFalse();
    tick(3000);
  }));

  it('shows a credential error when the API returns 401', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    const component = fixture.componentInstance;

    component.account.setValue('unknown@example.com');
    component.password.setValue('incorrect');
    component.submit();

    const request = http.expectOne(`${API_BASE_URL}/auth/login`);
    request.flush(
      { success: false, message: '帳號或密碼錯誤' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.notice).toBe('credential-error');
    expect(component.loginForm.enabled).toBeTrue();
    expect(component.isSubmitting).toBeFalse();
  });

  it('shows a password-expired notice when the API returns 403', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    component.account.setValue('user@example.com');
    component.password.setValue('expired-password');
    component.submit();

    const request = http.expectOne(`${API_BASE_URL}/auth/login`);
    request.flush(
      { success: false, passwordExpired: true },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(component.notice).toBe('password-expired');
    expect(component.loginForm.enabled).toBeTrue();
  });

  it('shows a service error for an unavailable API', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    component.account.setValue('user@example.com');
    component.password.setValue('user123');
    component.submit();

    const request = http.expectOne(`${API_BASE_URL}/auth/login`);
    request.flush(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });

    expect(component.notice).toBe('service-error');
    expect(component.loginForm.enabled).toBeTrue();
  });
});
