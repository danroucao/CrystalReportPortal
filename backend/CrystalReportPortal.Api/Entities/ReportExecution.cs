namespace CrystalReportPortal.Api.Entities;

public class ReportExecution
{
	public Guid ExecutionId { get; set; }

	public long ReportId { get; set; }

	public long UserId { get; set; }

	public string? ParametersJson { get; set; }

	public string Status { get; set; } = null!;

	public DateTime StartedAt { get; set; }

	public DateTime? CompletedAt { get; set; }

	public string? ErrorMessage { get; set; }


	// Navigation Properties
	public Report Report { get; set; } = null!;

	public User User { get; set; } = null!;

	public ICollection<AuditLog> AuditLogs { get; set; }
		= new List<AuditLog>();
}