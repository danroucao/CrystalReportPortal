using System;
using System.Collections.Generic;

namespace ReportSystem.Api.Models;

public partial class ReportExecution
{
    public Guid ExecutionId { get; set; }

    public long ReportId { get; set; }

    public long UserId { get; set; }

    public string? ParametersJson { get; set; }

    public string Status { get; set; } = null!;

    public DateTime StartedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public string? ErrorMessage { get; set; }

    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();

    public virtual Report Report { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
