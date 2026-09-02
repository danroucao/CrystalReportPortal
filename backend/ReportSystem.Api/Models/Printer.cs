using System;
using System.Collections.Generic;

namespace ReportSystem.Api.Models;

public partial class Printer
{
    public long PrinterId { get; set; }

    public string PrinterName { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}
