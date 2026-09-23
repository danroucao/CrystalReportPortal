export interface ManagedUserApiModel {
  userId: number;
  employeeNo: string;
  account: string;
  userName: string;
  isEnabled: boolean;
  roleCodes: string[];
}

export interface RoleOptionApiModel {
  roleCode: string;
  roleName: string;
}

export interface ManagedRoleApiModel {
  roleId: number;
  roleCode: string;
  roleName: string;
  description: string | null;
  isEnabled: boolean;
  permissionCodes: string[];
}

export interface PermissionApiModel {
  permissionId: number;
  permissionCode: string;
  permissionName: string;
  description: string | null;
}

export interface CreateManagedUserApiRequest {
  employeeNo: string;
  account: string;
  userName: string;
  initialPassword: string;
  roleCodes: string[];
  isEnabled: boolean;
}

export interface UpdateManagedUserApiRequest {
  employeeNo: string;
  account: string;
  userName: string;
  isEnabled: boolean;
}

export interface UpdateManagedUserStatusApiRequest {
  isEnabled: boolean;
}

export interface UpdateUserRolesApiRequest {
  roleCodes: string[];
}

export interface ResetUserPasswordApiRequest {
  newPassword: string;
}

export interface CreateRoleApiRequest {
  roleCode: string;
  roleName: string;
  description: string | null;
  isEnabled: boolean;
}

export interface UpdateRoleApiRequest {
  roleName: string;
  description: string | null;
  isEnabled: boolean;
}

export interface UpdateRolePermissionsApiRequest {
  permissionCodes: string[];
}
