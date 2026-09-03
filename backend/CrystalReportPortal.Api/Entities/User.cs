namespace CrystalReportPortal.Api.Entities;

public class User
{
    public long UserId { get; set; }

    public string EmployeeNo { get; set; } = null!;

    public string Account { get; set; } = null!;

    public string UserName { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

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