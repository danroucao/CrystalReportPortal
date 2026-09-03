using CrystalReportPortal.Api.Dtos;

namespace CrystalReportPortal.Api.Services;

public interface IReportService
{
    Task<ReportListResponse> GetReportsAsync(
        List<string> roleCodes);

    Task<bool> CanExecuteReportAsync(
        long reportId,
        List<string> roleCodes);

    Task<ReportParameterResponse> GetReportParametersAsync(
        long reportId,
        List<string> roleCodes);

    Task<ParameterOptionResponse> GetParameterOptionsAsync(
        long reportId,
        long parameterId,
        List<string> roleCodes);

    Task<RptUploadResponse> UploadRptAsync(
        long reportId,
        IFormFile file,
        long userId);
}