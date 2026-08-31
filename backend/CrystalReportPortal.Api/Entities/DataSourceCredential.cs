namespace CrystalReportPortal.Api.Entities;

public class DataSourceCredential
{
    public long CredentialId { get; set; }

    public long DataSourceId { get; set; }

    public string CredentialType { get; set; } = null!;

    public string Username { get; set; } = null!;

    public string EncryptedPassword { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }


    // Navigation Property
    public ReportDataSource DataSource { get; set; } = null!;
}