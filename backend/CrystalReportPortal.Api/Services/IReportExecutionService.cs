using CrystalReportPortal.Api.Dtos;

namespace CrystalReportPortal.Api.Services;

public interface IReportExecutionService
{
    Task<(Guid ExecutionId, byte[] Pdf)> ExecuteAsync(long reportId, long userId, List<string> roleCodes, ReportExecutionRequest request);
}
