export interface LoginRequest {
  account: string;
  password: string;
}

export interface AuthenticatedUser {
  userId: number;
  account: string;
  employeeNo: string;
  userName: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResponse {
  success: boolean;
  message: string;
  passwordExpired: boolean;
  token?: string;
  expiresAt?: string;
  user?: AuthenticatedUser;
}

export interface BackOfficeLoginResponse {
  success: boolean;
  message: string;
}

export interface BackOfficeOperator {
  userId: number;
  account: string;
  userName: string;
}

export interface BackOfficeOperatorResponse {
  success: boolean;
  message: string;
  passwordExpired: boolean;
  operator?: BackOfficeOperator;
}
