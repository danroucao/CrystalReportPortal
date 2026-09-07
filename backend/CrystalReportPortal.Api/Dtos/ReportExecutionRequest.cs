namespace CrystalReportPortal.Api.Dtos;

public class ReportExecutionRequest
{
    public List<ReportExecutionParameterRequest> Parameters { get; set; } = [];
}

public class ReportExecutionParameterRequest
{
    public long ParameterId { get; set; }

    public List<string> Values { get; set; } = [];
}
