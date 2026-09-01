import { Injectable } from '@angular/core';

export type MockDatabaseConnectionType = 'ReadOnly' | 'ReadWrite';

// This read model intentionally contains no password, encrypted value, or credential material.
export interface MockDatabaseConnection {
  Key: string;
  DataSourceName: string;
  ServerHost: string;
  Port: string;
  DatabaseName: string;
  Username: string;
  ConnectionType: MockDatabaseConnectionType;
  Enabled: boolean;
}

// Password is transient form input only. Mock storage never returns or retains it.
export interface MockDatabaseConnectionDraft
  extends Omit<MockDatabaseConnection, 'Key'> {
  Password: string;
}

@Injectable({ providedIn: 'root' })
export class MockDatabaseConnectionService {
  private readonly ConnectionsStore: MockDatabaseConnection[] = [
    {
      Key: 'ERP_READONLY',
      DataSourceName: 'ERP 唯讀資料庫',
      ServerHost: 'erp-sql.local',
      Port: '1433',
      DatabaseName: 'ERP',
      Username: 'report_reader',
      ConnectionType: 'ReadOnly',
      Enabled: true,
    },
    {
      Key: 'ERP_READWRITE',
      DataSourceName: 'ERP 維護資料庫',
      ServerHost: 'erp-sql.local',
      Port: '1433',
      DatabaseName: 'ERP',
      Username: 'report_writer',
      ConnectionType: 'ReadWrite',
      Enabled: false,
    },
  ];
  private NextConnectionId = 1;

  get Connections(): readonly MockDatabaseConnection[] {
    return this.ConnectionsStore.map((Connection) => ({ ...Connection }));
  }

  GetConnection(Key: string): MockDatabaseConnection | null {
    const Connection = this.ConnectionsStore.find((Entry) => Entry.Key === Key);
    return Connection ? { ...Connection } : null;
  }

  Create(Draft: MockDatabaseConnectionDraft): boolean {
    if (!this.IsValidDraft(Draft) || !Draft.Password) return false;
    this.ConnectionsStore.push({
      Key: `CONNECTION_${this.NextConnectionId++}`,
      ...this.ToSafeConnection(Draft),
    });
    return true;
  }

  Update(Key: string, Draft: MockDatabaseConnectionDraft): boolean {
    const Connection = this.ConnectionsStore.find((Entry) => Entry.Key === Key);
    if (!Connection || !this.IsValidDraft(Draft)) return false;
    Object.assign(Connection, this.ToSafeConnection(Draft));
    return true;
  }

  private IsValidDraft(Draft: MockDatabaseConnectionDraft): boolean {
    return Boolean(
      Draft.DataSourceName.trim() &&
        Draft.ServerHost.trim() &&
        Draft.Port.trim() &&
        Draft.DatabaseName.trim() &&
        Draft.Username.trim(),
    );
  }

  private ToSafeConnection(
    Draft: MockDatabaseConnectionDraft,
  ): Omit<MockDatabaseConnection, 'Key'> {
    return {
      DataSourceName: Draft.DataSourceName.trim(),
      ServerHost: Draft.ServerHost.trim(),
      Port: Draft.Port.trim(),
      DatabaseName: Draft.DatabaseName.trim(),
      Username: Draft.Username.trim(),
      ConnectionType: Draft.ConnectionType,
      Enabled: Draft.Enabled,
    };
  }
}
