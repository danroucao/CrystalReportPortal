import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api.config';
import {
  CreateManagedUserApiRequest,
  CreateRoleApiRequest,
  ManagedRoleApiModel,
  ManagedUserApiModel,
  PermissionApiModel,
  ResetUserPasswordApiRequest,
  RoleOptionApiModel,
  UpdateManagedUserApiRequest,
  UpdateManagedUserStatusApiRequest,
  UpdateRoleApiRequest,
  UpdateRolePermissionsApiRequest,
  UpdateUserRolesApiRequest,
} from './user-management-api.models';

@Injectable({
  providedIn: 'root',
})
export class UserManagementService {
  private readonly http = inject(HttpClient);

  private readonly usersUrl =
    `${API_BASE_URL}/backoffice/users`;

  private readonly rolesUrl =
    `${API_BASE_URL}/backoffice/roles`;

  getUsers(): Observable<ManagedUserApiModel[]> {
    return this.http.get<ManagedUserApiModel[]>(
      this.usersUrl,
    );
  }

  getRoleOptions(): Observable<RoleOptionApiModel[]> {
    return this.http.get<RoleOptionApiModel[]>(
      `${this.usersUrl}/roles`,
    );
  }

  createUser(
    request: CreateManagedUserApiRequest,
  ): Observable<ManagedUserApiModel> {
    return this.http.post<ManagedUserApiModel>(
      this.usersUrl,
      request,
    );
  }

  updateUser(
    userId: number,
    request: UpdateManagedUserApiRequest,
  ): Observable<unknown> {
    return this.http.put(
      `${this.usersUrl}/${userId}`,
      request,
    );
  }

  updateUserRoles(
    userId: number,
    request: UpdateUserRolesApiRequest,
  ): Observable<ManagedUserApiModel> {
    return this.http.put<ManagedUserApiModel>(
      `${this.usersUrl}/${userId}/roles`,
      request,
    );
  }

  updateUserStatus(
    userId: number,
    request: UpdateManagedUserStatusApiRequest,
  ): Observable<ManagedUserApiModel> {
    return this.http.put<ManagedUserApiModel>(
      `${this.usersUrl}/${userId}/status`,
      request,
    );
  }

  resetUserPassword(
    userId: number,
    request: ResetUserPasswordApiRequest,
  ): Observable<unknown> {
    return this.http.put(
      `${this.usersUrl}/${userId}/password`,
      request,
    );
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.usersUrl}/${userId}`);
  }

  getRoles(): Observable<ManagedRoleApiModel[]> {
    return this.http.get<ManagedRoleApiModel[]>(
      this.rolesUrl,
    );
  }

  getPermissions(): Observable<PermissionApiModel[]> {
    return this.http.get<PermissionApiModel[]>(
      `${this.rolesUrl}/permissions`,
    );
  }

  createRole(
    request: CreateRoleApiRequest,
  ): Observable<unknown> {
    return this.http.post(
      this.rolesUrl,
      request,
    );
  }

  updateRole(
    roleId: number,
    request: UpdateRoleApiRequest,
  ): Observable<unknown> {
    return this.http.put(
      `${this.rolesUrl}/${roleId}`,
      request,
    );
  }

  updateRolePermissions(
    roleId: number,
    request: UpdateRolePermissionsApiRequest,
  ): Observable<unknown> {
    return this.http.put(
      `${this.rolesUrl}/${roleId}/permissions`,
      request,
    );
  }

  deleteRole(roleId: number): Observable<void> {
    return this.http.delete<void>(`${this.rolesUrl}/${roleId}`);
  }
}
