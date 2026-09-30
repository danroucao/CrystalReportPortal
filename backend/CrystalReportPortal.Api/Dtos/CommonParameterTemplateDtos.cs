namespace CrystalReportPortal.Api.Dtos;

public class CommonParameterTemplateDto
{
    public long TemplateId { get; set; }
    public string TemplateCode { get; set; } = string.Empty;
    public string TemplateName { get; set; } = string.Empty;
    public string NormalizedParameterName { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public string InputType { get; set; } = string.Empty;
    public string ValueSourceType { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool AllowMultipleValues { get; set; }
    public bool AllowRangeValues { get; set; }
    public bool IsVisible { get; set; }
    public long? DataSourceId { get; set; }
    public string? DataSourceName { get; set; }
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
}

public class SaveCommonParameterTemplateRequest
{
    public string TemplateCode { get; set; } = string.Empty;
    public string TemplateName { get; set; } = string.Empty;
    public string NormalizedParameterName { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public string InputType { get; set; } = string.Empty;
    public string ValueSourceType { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool AllowMultipleValues { get; set; }
    public bool AllowRangeValues { get; set; }
    public bool IsVisible { get; set; } = true;
    public long? DataSourceId { get; set; }
    public string? SqlQuery { get; set; }
    public string? ValueField { get; set; }
    public string? DisplayField { get; set; }
    public string? DefaultValue { get; set; }
    public string? Description { get; set; }
}

public class UpdateCommonParameterTemplateStatusRequest
{
    public bool IsEnabled { get; set; }
}

public class CommonParameterTemplateUsageDto
{
    public long TemplateId { get; set; }
    public IReadOnlyList<CommonParameterTemplateUsageItemDto> Parameters { get; set; } = [];
}

public class CommonParameterTemplateUsageItemDto
{
    public long ReportId { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string ParameterName { get; set; } = string.Empty;
}
