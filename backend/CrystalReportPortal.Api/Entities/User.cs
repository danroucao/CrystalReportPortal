namespace CrystalReportPortal.Api.Entities;

public class User
{
    public long UserId { get; set; }

    public string EmployeeNo { get; set; } = null!;

    public string Account { get; set; } = null!;

    public string UserName { get; set; } = null!;

    /// <summary>
    /// The employee's organization department supplied with the AD user record.
    /// This is intentionally nullable so existing employee records remain valid
    /// until their source data has been enriched.
    /// </summary>
    public string? Department { get; set; }

    public string PasswordHash { get; set; } = null!;

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public int TokenVersion { get; set; }

    public DateTime? PasswordChangedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; }
        = new List<UserRole>();

    public ICollection<AuditLog> AuditLogs { get; set; }
        = new List<AuditLog>();

    public ICollection<ReportExecution> ReportExecutions { get; set; }
        = new List<ReportExecution>();

    public ICollection<Report> CreatedReports { get; set; }
        = new List<Report>();

    public ICollection<Report> UpdatedReports { get; set; }
        = new List<Report>();
}
