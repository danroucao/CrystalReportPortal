namespace CrystalReportPortal.Api.Dtos;

public class AdminReportParametersResponse
{
    public long ReportId { get; set; }
    public string ReportCode { get; set; } = string.Empty;
    public string ReportName { get; set; } = string.Empty;
    public string ConfigurationStatus { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public bool AllParametersConfigured { get; set; }
    public List<AdminReportParameterDto> Parameters { get; set; } = new();
}

public class AdminReportParameterDto
{
    public long ParameterId { get; set; }
    public string ParameterName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public string InputType { get; set; } = string.Empty;
    public string ValueSourceType { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool AllowMultipleValues { get; set; }
    public bool AllowRangeValues { get; set; }
    public bool IsVisible { get; set; }
    public string? DefaultValue { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsConfigured { get; set; }
    public long? CommonTemplateId { get; set; }
    public string? CommonTemplateName { get; set; }
    public long? DataSourceId { get; set; }
    public string? SqlQuery { get; set; }
    public string? ValueField { get; set; }
    public string? DisplayField { get; set; }
}

public class UpdateAdminReportParameterRequest
{
    public long? CommonTemplateId { get; set; }
    public string? DisplayName { get; set; }
    public string? DataType { get; set; }
    public string? InputType { get; set; }
    public string? ValueSourceType { get; set; }
    public bool IsRequired { get; set; }
    public bool AllowMultipleValues { get; set; }
    public bool AllowRangeValues { get; set; }
    public bool IsVisible { get; set; } = true;
    public string? DefaultValue { get; set; }
    public string? Description { get; set; }
    public long? DataSourceId { get; set; }
    public string? SqlQuery { get; set; }
    public string? ValueField { get; set; }
    public string? DisplayField { get; set; }
    public bool AddToCommonTemplates { get; set; }
    public string? NewTemplateCode { get; set; }
    public string? NewTemplateName { get; set; }
}

public class CompleteReportParameterConfigurationResponse
{
    public bool Success { get; set; }
    public long ReportId { get; set; }
    public string ConfigurationStatus { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public string Message { get; set; } = string.Empty;
}
