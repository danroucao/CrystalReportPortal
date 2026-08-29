using System;
using System.Collections.Generic;

namespace ReportSystem.Api.Models;

public partial class RoleReportPermission
{
    public int RoleId { get; set; }

    public long ReportId { get; set; }

    public bool CanExecute { get; set; }

    public bool CanExport { get; set; }

    public bool CanPrint { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Report Report { get; set; } = null!;

    public virtual Role Role { get; set; } = null!;
}
