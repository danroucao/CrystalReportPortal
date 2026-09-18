namespace CrystalReportPortal.Api.Dtos;

public class CreateReportRequest
{
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int CategoryId { get; set; }
    public long? DataSourceId { get; set; }
    public string CredentialType { get; set; } = "ReadOnly";
}

public class AdminReportDto
{
    public long ReportId { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public long? DataSourceId { get; set; }
    public string DataSourceName { get; set; } = string.Empty;
    public string CredentialType { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public string ConfigurationStatus { get; set; } = "Draft";
    public string RptFileName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CategoryOptionDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
}

public class DataSourceOptionDto
{
    public long? DataSourceId { get; set; }
    public string? DataSourceName { get; set; }
}
