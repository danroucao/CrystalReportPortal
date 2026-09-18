import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

type NoticeKind =
  | 'credential-error'
  | 'service-error'
  | 'session-expired'
  | 'password-expired'
  | null;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly Auth = inject(AuthService);
  readonly Notifications = inject(NotificationService);

  readonly loginForm = this.formBuilder.nonNullable.group({
    account: ['', Validators.required],
    password: ['', Validators.required],
  });

  submitted = false;
  isSubmitting = false;
  passwordVisible = false;
  notice: NoticeKind = null;
  serviceErrorMessage = '';

  ngOnInit(): void {
    const state = this.route.snapshot.queryParamMap.get('state');

    if (state === 'invalid-credentials') {
      this.notice = 'credential-error';
    } else if (state === 'service-error' || state === 'session-expired') {
      this.notice = state;
    }
  }

  get account() {
    return this.loginForm.controls.account;
  }

  get password() {
    return this.loginForm.controls.password;
  }

  get noticeMessage(): string {
    if (this.notice === 'service-error' && this.serviceErrorMessage) {
      return this.serviceErrorMessage;
    }
    switch (this.notice) {
      case 'credential-error':
        return '帳號或密碼錯誤，請確認後再試一次。';
      case 'service-error':
        return '目前無法完成登入，請稍後再試。';
      case 'session-expired':
        return '登入已逾時，請重新登入。';
      case 'password-expired':
        return '密碼已過期，請先修改密碼。';
      default:
        return '';
    }
  }

  get noticeClass(): string {
    return this.notice === 'session-expired'
      ? 'notice notice--session'
      : 'notice';
  }

  togglePassword(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  clearNotice(): void {
    if (!this.isSubmitting) this.notice = null;
  }

  submit(): void {
    this.submitted = true;
    this.notice = null;
    this.serviceErrorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.loginForm.disable();

    this.Auth.LoginUnified(this.account.value, this.password.value)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.loginForm.enable();
        }),
      )
      .subscribe({
        next: () => {
          this.Notifications.ShowSuccess('登入成功！');
          void this.router.navigate([this.Auth.HomeRoute]).then((navigated) => {
            if (!navigated) {
              this.notice = 'service-error';
            }
          });
        },
        error: (LoginError: unknown) => {
          if (LoginError instanceof HttpErrorResponse) {
            const ApiMessage =
              typeof LoginError.error?.message === 'string'
                ? LoginError.error.message
                : '';
            if (LoginError.status === 401) {
              this.notice = 'credential-error';
              return;
            }

            if (LoginError.status === 403 && LoginError.error?.passwordExpired === true) {
              this.notice = 'password-expired';
              return;
            }

            if (ApiMessage) {
              this.serviceErrorMessage = ApiMessage;
              this.notice = 'service-error';
              return;
            }
          }

          if (LoginError instanceof Error && LoginError.message) {
            this.serviceErrorMessage = LoginError.message;
          }

          this.notice = 'service-error';
        },
      });
  }

}
