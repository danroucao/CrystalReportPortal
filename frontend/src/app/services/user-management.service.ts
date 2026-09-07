import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api.config';

export interface ManagedUser { userId: number; employeeNo: string; account: string; userName: string; isEnabled: boolean; roleCodes: string[]; }
export interface RoleOption { roleCode: string; roleName: string; }
export interface CreateUserRequest { employeeNo: string; account: string; userName: string; initialPassword: string; roleCodes: string[]; isEnabled: boolean; }

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  constructor(private readonly http: HttpClient) {}
  getUsers(): Observable<ManagedUser[]> { return this.http.get<ManagedUser[]>(`${API_BASE_URL}/users`); }
  getRoles(): Observable<RoleOption[]> { return this.http.get<RoleOption[]>(`${API_BASE_URL}/users/roles`); }
  createUser(request: CreateUserRequest): Observable<ManagedUser> { return this.http.post<ManagedUser>(`${API_BASE_URL}/users`, request); }
}
