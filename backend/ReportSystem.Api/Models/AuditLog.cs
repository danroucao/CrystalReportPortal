using System;
using System.Collections.Generic;

namespace ReportSystem.Api.Models;

public partial class AuditLog
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

    public virtual ReportExecution? Execution { get; set; }

    public virtual Printer? Printer { get; set; }

    public virtual Report? Report { get; set; }

    public virtual User? User { get; set; }
}
