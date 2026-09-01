namespace CrystalReportPortal.Api.Entities;

public class ParameterLovConfig
{
    public long LovConfigId { get; set; }

    public long ParameterId { get; set; }

    public long DataSourceId { get; set; }

    public string SqlQuery { get; set; } = null!;

    public string ValueField { get; set; } = null!;

    public string DisplayField { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public ReportParameter Parameter { get; set; } = null!;

    public ReportDataSource DataSource { get; set; } = null!;
}