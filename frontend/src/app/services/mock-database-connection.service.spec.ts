import { MockDatabaseConnectionService } from './mock-database-connection.service';

describe('MockDatabaseConnectionService', () => {
  let Service: MockDatabaseConnectionService;

  beforeEach(() => {
    Service = new MockDatabaseConnectionService();
  });

  it('never exposes or retains a database password in its read model', () => {
    expect(
      Service.Create({
        DataSourceName: '測試資料來源',
        ServerHost: 'sql.test.local',
        Port: '1433',
        DatabaseName: 'TestDb',
        Username: 'report_reader',
        ConnectionType: 'ReadOnly',
        Enabled: true,
        Password: 'not-retained-in-mock',
      }),
    ).toBeTrue();

    const Created = Service.Connections.find(
      (Connection) => Connection.DataSourceName === '測試資料來源',
    ) as unknown as Record<string, unknown>;
    expect(Created['Password']).toBeUndefined();
    expect(Created['EncryptedPassword']).toBeUndefined();
  });

  it('allows an edit without returning or requiring the existing password', () => {
    const Connection = Service.Connections[0];
    expect(Service.GetConnection(Connection.Key)).toEqual(Connection);

    expect(
      Service.Update(Connection.Key, {
        DataSourceName: 'ERP 唯讀資料庫（更新）',
        ServerHost: Connection.ServerHost,
        Port: Connection.Port,
        DatabaseName: Connection.DatabaseName,
        Username: Connection.Username,
        ConnectionType: Connection.ConnectionType,
        Enabled: Connection.Enabled,
        Password: '',
      }),
    ).toBeTrue();

    expect(Service.GetConnection(Connection.Key)?.DataSourceName).toBe(
      'ERP 唯讀資料庫（更新）',
    );
  });
});
