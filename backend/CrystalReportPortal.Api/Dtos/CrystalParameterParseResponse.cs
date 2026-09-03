namespace CrystalReportPortal.Api.Dtos;

public class CrystalParameterParseResponse
{
    public bool Success { get; set; }

    public string? Message { get; set; }

    public List<CrystalParameterDto> Parameters { get; set; } = [];
}

public class CrystalParameterDto
{
    public string Name { get; set; } = string.Empty;

    public string? PromptText { get; set; }

    public string ValueType { get; set; } = string.Empty;

    public bool AllowMultipleValues { get; set; }

    public bool AllowRangeValues { get; set; }

    public bool IsOptional { get; set; }
}