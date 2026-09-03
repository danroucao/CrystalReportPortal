namespace CrystalReportPortal.Api.Dtos;

public class ReportParameterResponse
{
    public bool Success { get; set; } = true;

    public List<ReportParameterDto> Data { get; set; } = [];
}

public class ReportParameterDto
{
    public long ParameterId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string DataType { get; set; } = string.Empty;

    public string InputType { get; set; } = string.Empty;

    public bool Required { get; set; }

    public bool Multiple { get; set; }

    public bool Range { get; set; }

    public string ValueSource { get; set; } = string.Empty;

    public bool Visible { get; set; }

    public int DisplayOrder { get; set; }
}