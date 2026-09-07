import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { API_BASE_URL } from './api.config';

export interface SessionUser {
  userId: number;
  account: string;
  employeeNo: string;
  userName: string;
  roles: string[];
}

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: SessionUser;
}

@Injectable({ providedIn: 'root' })
export class SessionAuthService {
  private user: SessionUser | null = null;
  private token: string | null = null;

  constructor(private readonly http: HttpClient) {
    this.restoreSession();
  }

  get CurrentUser(): SessionUser | null { return this.user; }
  get IsAuthenticated(): boolean { return this.user !== null && this.token !== null; }
  get IsAdmin(): boolean { return this.user?.roles.includes('ADMIN') ?? false; }
  get ActiveRoleNames(): string { return this.user?.roles.join(', ') ?? ''; }
  get IsDemoAuthenticationEnabled(): boolean { return false; }

  login(account: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, { account, password }).pipe(
      tap(response => {
        if (!response.success || !response.token || !response.user) return;
        this.token = response.token;
        this.user = response.user;
        sessionStorage.setItem('crystal-report-token', response.token);
        sessionStorage.setItem('crystal-report-user', JSON.stringify(response.user));
        sessionStorage.removeItem('crystal-report-selected-report');
      }),
    );
  }

  logout(): void {
    this.user = null;
    this.token = null;
    sessionStorage.removeItem('crystal-report-token');
    sessionStorage.removeItem('crystal-report-user');
    sessionStorage.removeItem('crystal-report-selected-report');
  }

  private restoreSession(): void {
    const token = sessionStorage.getItem('crystal-report-token');
    const serialized = sessionStorage.getItem('crystal-report-user');
    if (!token || !serialized) return;
    try { this.token = token; this.user = JSON.parse(serialized) as SessionUser; }
    catch { this.logout(); }
  }
}
