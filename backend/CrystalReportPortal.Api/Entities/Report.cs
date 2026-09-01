namespace CrystalReportPortal.Api.Entities;

public class Report
{
    public long ReportId { get; set; }

    public string ReportCode { get; set; } = null!;

    public string ReportName { get; set; } = null!;

    public string? Description { get; set; }

    public int CategoryId { get; set; }

    public long DataSourceId { get; set; }

    public string CredentialType { get; set; } = null!;

    public string RptFileName { get; set; } = null!;

    public string RptFilePath { get; set; } = null!;

    public bool IsEnabled { get; set; }

    public long CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public long? UpdatedBy { get; set; }

    public DateTime? UpdatedAt { get; set; }


    // Navigation Properties
    public ReportCategory Category { get; set; } = null!;

    public ReportDataSource DataSource { get; set; } = null!;

    public User Creator { get; set; } = null!;

    public User? Updater { get; set; }

    public ICollection<RoleReportPermission> RoleReportPermissions { get; set; }
        = new List<RoleReportPermission>();

    public ICollection<ReportParameter> ReportParameters { get; set; }
        = new List<ReportParameter>();

    public ICollection<ReportExecution> ReportExecutions { get; set; }
        = new List<ReportExecution>();

    public ICollection<AuditLog> AuditLogs { get; set; }
        = new List<AuditLog>();
}