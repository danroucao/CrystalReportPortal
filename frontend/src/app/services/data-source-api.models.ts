export interface DataSourceManagementModel {
  dataSourceId: number;
  dataSourceName: string;
  serverHost: string;
  port: number;
  databaseName: string;
  isEnabled: boolean;
  authenticationType: 'Windows' | 'SqlServer' | string;
  username: string;
  hasPassword: boolean;
}

export interface SaveDataSourceRequest {
  dataSourceName: string;
  serverHost: string;
  port: number;
  databaseName: string;
  isEnabled: boolean;
}

export interface SaveManagedDataSourceRequest extends SaveDataSourceRequest {
  authenticationType: 'Windows' | 'SqlServer';
  username?: string;
  password?: string;
}

export interface DataSourceConnectionTestResponse {
  success: boolean;
  connected: boolean;
  server?: string | null;
  database?: string | null;
  loginName?: string | null;
  detailCount: number;
  elapsedMilliseconds: number;
  message?: string | null;
}
