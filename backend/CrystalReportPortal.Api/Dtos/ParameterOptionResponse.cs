namespace CrystalReportPortal.Api.Dtos;

public class ParameterOptionResponse
{
    public bool Success { get; set; } = true;

    public List<ParameterOptionDto> Data { get; set; } = [];
}

public class ParameterOptionDto
{
    public string Value { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;
}