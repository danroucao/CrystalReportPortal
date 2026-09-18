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
