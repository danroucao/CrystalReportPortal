namespace CrystalReportPortal.Api.Entities;

public class ReportParameter
{
    public long ParameterId { get; set; }

    public long ReportId { get; set; }

    public string ParameterName { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public string DataType { get; set; } = null!;

    public string InputType { get; set; } = null!;

    public string ValueSourceType { get; set; } = null!;

    public bool IsRequired { get; set; }

    public bool AllowMultipleValues { get; set; }

    public bool AllowRangeValues { get; set; }

    public bool IsVisible { get; set; }

    public string? DefaultValue { get; set; }

    public string? Description { get; set; }

    public int DisplayOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }


    // Navigation Properties
    public Report Report { get; set; } = null!;

    public ParameterLovConfig? LovConfig { get; set; }
}