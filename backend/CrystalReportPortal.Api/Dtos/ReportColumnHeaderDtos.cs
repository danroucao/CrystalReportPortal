namespace CrystalReportPortal.Api.Dtos;

public class ReportColumnHeaderMappingDto
{
    public string SourceText { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}

public class SaveReportColumnHeaderMappingsRequest
{
    public List<ReportColumnHeaderMappingDto> Mappings { get; set; } = [];
}
