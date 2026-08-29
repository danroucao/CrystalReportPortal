using System;
using System.Collections.Generic;

namespace ReportSystem.Api.Models;

public partial class Report
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

    public long? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public long? UpdatedBy { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();

    public virtual ReportCategory Category { get; set; } = null!;

    public virtual User? CreatedByNavigation { get; set; }

    public virtual ReportDataSource DataSource { get; set; } = null!;

    public virtual ICollection<ReportExecution> ReportExecutions { get; set; } = new List<ReportExecution>();

    public virtual ICollection<ReportParameter> ReportParameters { get; set; } = new List<ReportParameter>();

    public virtual ICollection<RoleReportPermission> RoleReportPermissions { get; set; } = new List<RoleReportPermission>();

    public virtual User? UpdatedByNavigation { get; set; }
}
