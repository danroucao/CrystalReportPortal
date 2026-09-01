using System;
using System.Collections.Generic;

namespace ReportSystem.Api.Models;

public partial class User
{
    public long UserId { get; set; }

    public string EmployeeNo { get; set; } = null!;

    public string UserName { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public int TokenVersion { get; set; }

    public DateTime? PasswordChangedAt { get; set; }

    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();

    public virtual ICollection<Report> ReportCreatedByNavigations { get; set; } = new List<Report>();

    public virtual ICollection<ReportExecution> ReportExecutions { get; set; } = new List<ReportExecution>();

    public virtual ICollection<Report> ReportUpdatedByNavigations { get; set; } = new List<Report>();

    public virtual ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();

}
