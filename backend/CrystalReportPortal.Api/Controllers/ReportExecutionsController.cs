using System.Security.Claims;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Entities;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportExecutionsController : ControllerBase
{
    private readonly IReportExecutionService _executions;
    private readonly IReportService _reportService;
    private readonly IReportPreviewImageService _previewImages;
    private readonly AppDbContext _db;

    public ReportExecutionsController(
    IReportExecutionService executions,
    IReportService reportService,
    IReportPreviewImageService previewImages,
    AppDbContext db)
    {
        _executions = executions;
        _reportService = reportService;
        _previewImages = previewImages;
        _db = db;
    }

    [HttpPost("{reportId:long}/execute")]
    public async Task<IActionResult> Execute(
        long reportId,
        ReportExecutionRequest request,
        [FromQuery] string? output = null)
    {
        var userIdText =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (!long.TryParse(
                userIdText,
                out var userId))
        {
            return Unauthorized();
        }

        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var canExecute =
            await _reportService.CanExecuteReportAsync(
                reportId,
                roleCodes);

        var isExport = string.Equals(output, "export", StringComparison.OrdinalIgnoreCase);
        var isPrint = string.Equals(output, "print", StringComparison.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(output) && !isExport && !isPrint)
            return BadRequest(new { message = "Unsupported report output mode." });

        var hasOutputPermission = !isExport && !isPrint ||
            (isExport
                ? await _reportService.CanExportReportAsync(reportId, roleCodes)
                : await _reportService.CanPrintReportAsync(reportId, roleCodes));

        if (!canExecute || !hasOutputPermission)
        {
            return Forbid();
        }

        try
        {
            var result =
                await _executions.ExecuteAsync(
                    reportId,
                    userId,
                    roleCodes,
                    request);

            if (isExport || isPrint)
            {
                _db.AuditLogs.Add(new AuditLog
                {
                    UserId = userId,
                    ReportId = reportId,
                    ExecutionId = result.ExecutionId,
                    Action = isExport ? "EXPORT_REPORT" : "PRINT_REPORT",
                    Result = "SUCCESS",
                    Details = isExport ? "使用者下載報表 PDF。" : "使用者開啟報表列印。",
                    CreatedAt = DateTime.UtcNow
                });
                await _db.SaveChangesAsync();
                Response.Headers.Append("X-Report-Execution-Id", result.ExecutionId.ToString());
                return File(result.Pdf, "application/pdf", $"report-{reportId}-{result.ExecutionId:N}.pdf");
            }

            // Preview-only users receive images rather than the original PDF.
            return Ok(await _previewImages.CreateAsync(result.Pdf, userId));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return UnprocessableEntity(new
            {
                message = "報表資料來源或資料庫憑證設定無法使用。",
                detail = exception.Message
            });
        }
    }
}
