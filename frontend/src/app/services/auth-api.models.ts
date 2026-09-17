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
