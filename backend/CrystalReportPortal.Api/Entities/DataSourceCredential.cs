namespace CrystalReportPortal.Api.Entities;

public class DataSourceCredential
{
    public long CredentialId { get; set; }

    public long DataSourceId { get; set; }

    public string CredentialType { get; set; } = string.Empty;

    public string AuthenticationType { get; set; } = "SqlServer";

    public string? Username { get; set; }

    public string? EncryptedPassword { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public ReportDataSource DataSource { get; set; } = null!;
}