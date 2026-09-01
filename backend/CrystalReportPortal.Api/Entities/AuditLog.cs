namespace CrystalReportPortal.Api.Entities;

public class AuditLog
{
    public long AuditLogId { get; set; }

    public long? UserId { get; set; }

    public long? ReportId { get; set; }

    public Guid? ExecutionId { get; set; }

    public long? PrinterId { get; set; }

    public string Action { get; set; } = null!;

    public string Result { get; set; } = null!;

    public string? Details { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTime CreatedAt { get; set; }


    // Navigation Properties
    public User? User { get; set; }

    public Report? Report { get; set; }

    public ReportExecution? Execution { get; set; }

    public Printer? Printer { get; set; }
}