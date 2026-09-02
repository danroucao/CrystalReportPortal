using System;
using System.Collections.Generic;

namespace ReportSystem.Api.Models;

public partial class ReportDataSource
{
    public long DataSourceId { get; set; }

    public string DataSourceName { get; set; } = null!;

    public string ServerHost { get; set; } = null!;

    public int Port { get; set; }

    public string DatabaseName { get; set; } = null!;

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<DataSourceCredential> DataSourceCredentials { get; set; } = new List<DataSourceCredential>();

    public virtual ICollection<ParameterLovConfig> ParameterLovConfigs { get; set; } = new List<ParameterLovConfig>();

    public virtual ICollection<Report> Reports { get; set; } = new List<Report>();
}
