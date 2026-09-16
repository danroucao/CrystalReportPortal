using CrystalReportPortal.Api.Dtos;
using Microsoft.EntityFrameworkCore;

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

    Task<bool> CanUploadReportAsync(
    long reportId,
    List<string> roleCodes);

    Task<bool> CanExportReportAsync(
    long reportId,
    List<string> roleCodes);

    Task<bool> CanPrintReportAsync(
    long reportId,
    List<string> roleCodes);

    Task<bool> CanMaintainReportAsync(
        long reportId,
        List<string> roleCodes);

    Task<bool> CanSetParametersReportAsync(
        long reportId,
        List<string> roleCodes);

    Task<bool> CanEnableDisableReportAsync(
        long reportId,
        List<string> roleCodes);
}