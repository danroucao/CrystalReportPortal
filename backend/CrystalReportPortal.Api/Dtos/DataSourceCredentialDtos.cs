namespace CrystalReportPortal.Api.Dtos;

public sealed class UpdateDataSourceCredentialRequest
{
    public string AuthenticationType { get; set; } = string.Empty;

    public string? Username { get; set; }

    // 留空代表保留原有密碼，後端回應也永遠不回傳密碼。
    public string? Password { get; set; }
}

public sealed class DataSourceCredentialResponse
{
    public long DataSourceId { get; set; }

    public string CredentialType { get; set; } = string.Empty;

    public string AuthenticationType { get; set; } = string.Empty;

    public string? Username { get; set; }

    public bool HasPassword { get; set; }

    public DateTime? UpdatedAt { get; set; }
}