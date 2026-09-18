namespace CrystalReportPortal.Api.Dtos;

public class DataSourceManagementDto
{
    public long DataSourceId { get; set; }
    public string DataSourceName { get; set; } = string.Empty;
    public string ServerHost { get; set; } = string.Empty;
    public int Port { get; set; }
    public string DatabaseName { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public string AuthenticationType { get; set; } = "SqlServer";
    public string Username { get; set; } = string.Empty;
    public bool HasPassword { get; set; }
}

public class SaveDataSourceRequest
{
    public string DataSourceName { get; set; } = string.Empty;
    public string ServerHost { get; set; } = string.Empty;
    public int Port { get; set; }
    public string DatabaseName { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
}