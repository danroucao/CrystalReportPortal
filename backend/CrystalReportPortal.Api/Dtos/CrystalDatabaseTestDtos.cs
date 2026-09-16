namespace CrystalReportPortal.Api.Dtos;

/// <summary>
/// 傳送給 Crystal Service 的資料庫連線設定。
/// </summary>
public class CrystalDatabaseTestRequest
{
    public string Server { get; set; } = string.Empty;

    public string Database { get; set; } = string.Empty;

    public bool IntegratedSecurity { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// Crystal Service 的資料庫連線測試結果。
/// </summary>
public class CrystalDatabaseTestResponse
{
    public bool Success { get; set; }

    public bool Connected { get; set; }

    public string? Server { get; set; }

    public string? Database { get; set; }

    public string? LoginName { get; set; }

    public int DetailCount { get; set; }

    public long ElapsedMilliseconds { get; set; }

    public string? Message { get; set; }
}