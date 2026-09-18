namespace CrystalReportPortal.Api.Entities;

public class CommonParameterTemplate
{
    public long TemplateId { get; set; }
    public string TemplateCode { get; set; } = null!;
    public string TemplateName { get; set; } = null!;
    public string NormalizedParameterName { get; set; } = null!;
    public string DataType { get; set; } = null!;
    public string InputType { get; set; } = null!;
    public string ValueSourceType { get; set; } = null!;
    public bool IsRequired { get; set; }
    public bool AllowMultipleValues { get; set; }
    public bool AllowRangeValues { get; set; }
    public bool IsVisible { get; set; }
    public long? DataSourceId { get; set; }
    public string? SqlQuery { get; set; }
    public string? ValueField { get; set; }
    public string? DisplayField { get; set; }
    public string? DefaultValue { get; set; }
    public string? Description { get; set; }
    public bool IsEnabled { get; set; }
    public long CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public long? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public ReportDataSource? DataSource { get; set; }
    public User Creator { get; set; } = null!;
    public User? Updater { get; set; }
    public ICollection<ReportParameter> ReportParameters { get; set; } = new List<ReportParameter>();
}
