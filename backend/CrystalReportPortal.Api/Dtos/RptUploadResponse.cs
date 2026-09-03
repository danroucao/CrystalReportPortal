namespace CrystalReportPortal.Api.Dtos;

public class RptUploadResponse
{
    public bool Success { get; set; }

    public string? Message { get; set; }

    public RptUploadResultDto? Data { get; set; }
}

public class RptUploadResultDto
{
    public long ReportId { get; set; }

    public string FileName { get; set; } = string.Empty;

    public string FilePath { get; set; } = string.Empty;

    public int ParameterCount { get; set; }

    public List<RptUploadParameterDto> Parameters { get; set; } = [];
}

public class RptUploadParameterDto
{
    public string Name { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string DataType { get; set; } = string.Empty;

    public string InputType { get; set; } = string.Empty;

    public string ValueSource { get; set; } = string.Empty;

    public bool Multiple { get; set; }
}