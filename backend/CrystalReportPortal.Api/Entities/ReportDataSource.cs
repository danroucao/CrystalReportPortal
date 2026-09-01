namespace CrystalReportPortal.Api.Entities;

public class ReportDataSource
{
    public long DataSourceId { get; set; }

    public string DataSourceName { get; set; } = null!;

    public string ServerHost { get; set; } = null!;

    public int Port { get; set; }

    public string DatabaseName { get; set; } = null!;

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }


    // Navigation Properties
    public ICollection<Report> Reports { get; set; }
        = new List<Report>();

    public ICollection<DataSourceCredential> Credentials { get; set; }
        = new List<DataSourceCredential>();

    public ICollection<ParameterLovConfig> ParameterLovConfigs { get; set; }
        = new List<ParameterLovConfig>();
}