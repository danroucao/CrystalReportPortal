using System;
using System.Collections.Generic;

namespace ReportSystem.Api.Models;

public partial class DataSourceCredential
{
    public long CredentialId { get; set; }

    public long DataSourceId { get; set; }

    public string CredentialType { get; set; } = null!;

    public string Username { get; set; } = null!;

    public string EncryptedPassword { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ReportDataSource DataSource { get; set; } = null!;
}
