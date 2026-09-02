using ReportSystem.Api.Dtos;

namespace ReportSystem.Api.Services;

public interface IReportService
{
    Task<ReportListResponse> GetReportsAsync(List<string> roleCodes);

    Task<bool> CanExecuteReportAsync(long reportId, List<string> roleCodes);
}
