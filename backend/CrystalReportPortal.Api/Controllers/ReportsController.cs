using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ICrystalProcessService _crystalProcessService;
    private readonly ICrystalExportProcessService _crystalExportProcessService;
    private readonly IReportPreviewImageService _previewImages;
    private readonly AppDbContext _dbContext;

    public ReportsController(
        IReportService reportService,
        ICrystalProcessService crystalProcessService,
        ICrystalExportProcessService crystalExportProcessService,
        IReportPreviewImageService previewImages,
        AppDbContext dbContext)
    {
        _reportService = reportService;
        _crystalProcessService = crystalProcessService;
        _crystalExportProcessService = crystalExportProcessService;
        _previewImages = previewImages;
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetReports()
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var result =
            await _reportService
                .GetReportsAsync(roleCodes);

        return Ok(result);
    }

    [HttpGet("{reportId:long}/execute-access")]
    public async Task<IActionResult> CheckExecuteAccess(
        long reportId)
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var allowed =
            await _reportService
                .CanExecuteReportAsync(
                    reportId,
                    roleCodes);

        if (!allowed)
        {
            return Forbid();
        }

        return Ok(new
        {
            success = true,
            message = "具有執行此報表的權限",
            reportId
        });
    }

    [HttpGet("{reportId:long}/parameters")]
    public async Task<IActionResult> GetParameters(
    long reportId)
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var allowed =
            await _reportService
                .CanExecuteReportAsync(
                    reportId,
                    roleCodes);

        if (!allowed)
        {
            return Forbid();
        }

        var result =
            await _reportService
                .GetReportParametersAsync(
                    reportId,
                    roleCodes);

        return Ok(result);
    }

    [HttpGet("{reportId:long}/parameters/{parameterId:long}/options")]
    public async Task<IActionResult> GetParameterOptions(
        long reportId,
        long parameterId)
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var allowed =
            await _reportService.CanExecuteReportAsync(
                reportId,
                roleCodes);

        // 載入 LOV 選項屬於設定查詢條件，不是匯出報表。
        // 只要具有閱覽／執行權限即可取得選項；匯出權限會在真正
        // 匯出檔案時另行驗證。
        if (!allowed)
        {
            var reportCategory = await _dbContext.Reports
                .AsNoTracking()
                .Where(report => report.ReportId == reportId)
                .Select(report => new { report.CategoryId, report.Category.CategoryName })
                .FirstOrDefaultAsync();
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                success = false,
                message = "目前 Token 未取得此報表分類的可執行權限。",
                categoryId = reportCategory?.CategoryId,
                categoryName = reportCategory?.CategoryName,
                tokenRoleCodes = roleCodes,
                hint = "請確認帳號已指派到上述角色之一，且該角色的此分類「閱覽」已儲存；之後請登出再登入。"
            });
        }

        try
        {
            var result =
                await _reportService.GetParameterOptionsAsync(
                    reportId,
                    parameterId,
                    roleCodes);

            return Ok(result);
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new
            {
                success = false,
                message = exception.Message
            });
        }
        catch (InvalidOperationException exception)
        {
            return UnprocessableEntity(new
            {
                success = false,
                message = exception.Message
            });
        }
    }

    [HttpGet("test-crystal-parameters")]
    public async Task<IActionResult> TestCrystalParameters()
    {
        var rptPath =
            @"C:\GitHub\CrystalReportPortal\reports\參數練習-零售銷售明細.rpt";

        var result = await _crystalProcessService
            .GetParametersAsync(rptPath);

        return Ok(result);
    }

    [HttpPost("{reportId:long}/rpt")]
    [Authorize(Policy = "Report.Upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadRpt(
    long reportId,
    IFormFile file)
    {
        var roleCodes = User
    .FindAll(ClaimTypes.Role)
    .Select(claim => claim.Value)
    .ToList();

        var allowed = await _reportService.CanUploadReportAsync(
            reportId,
            roleCodes);

        if (!allowed)
        {
            return Forbid();
        }

        if (file == null ||
            file.Length == 0)
        {
            return BadRequest(new
            {
                success = false,
                message = "請選擇 RPT 檔案。"
            });
        }

        var userIdValue =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (!long.TryParse(
            userIdValue,
            out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var result =
                await _reportService.UploadRptAsync(
                    reportId,
                    file,
                    userId);

            return Ok(result);
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new
            {
                success = false,
                message = exception.Message
            });
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new
            {
                success = false,
                message = exception.Message
            });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new
            {
                success = false,
                message = exception.Message
            });
        }
    }

    [HttpGet("{reportId:long}/preview")]
    public async Task<IActionResult> PreviewReport(
    long reportId,
    [FromQuery] string? output = null)
    {
        var roleCodes = User
    .FindAll(ClaimTypes.Role)
    .Select(claim => claim.Value)
    .ToList();

        var allowed =
            await _reportService.CanExecuteReportAsync(
                reportId,
                roleCodes);

        if (!allowed)
        {
            return Forbid();
        }

        var isExport = string.Equals(output, "export", StringComparison.OrdinalIgnoreCase);
        var isPrint = string.Equals(output, "print", StringComparison.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(output) && !isExport && !isPrint)
            return BadRequest(new { message = "Unsupported report output mode." });
        if (isExport && !await _reportService.CanExportReportAsync(reportId, roleCodes)) return Forbid();
        if (isPrint && !await _reportService.CanPrintReportAsync(reportId, roleCodes)) return Forbid();

        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized();

        var report =
            await _dbContext.Reports
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    r => r.ReportId == reportId);

        if (report == null)
        {
            return NotFound(new
            {
                success = false,
                message = "找不到報表。"
            });
        }

        if (string.IsNullOrWhiteSpace(
            report.RptFilePath))
        {
            return BadRequest(new
            {
                success = false,
                message = "此報表尚未上傳 RPT 檔案。"
            });
        }

        if (!System.IO.File.Exists(
            report.RptFilePath))
        {
            return NotFound(new
            {
                success = false,
                message = "找不到 RPT 實體檔案。"
            });
        }

        try
        {
            IReadOnlyList<string> detectedHeaders = [];
            try
            {
                detectedHeaders = await _crystalProcessService
                    .GetHeaderTextsAsync(report.RptFilePath);
            }
            catch
            {
                // Saved custom mappings can still be applied if Crystal cannot inspect the RPT.
            }

            var pdfBytes = await _crystalExportProcessService.ExportPdfAsync(
                new CrystalExportProcessRequest
                {
                    RptPath = report.RptFilePath,
                    UseSavedDataOnly = true,
                    Parameters = [],
                    HeaderTextReplacements = ReportHeaderLocalization.BuildReplacements(
                        report.ColumnHeaderMappingsJson,
                        detectedHeaders)
                });

            if (isExport || isPrint)
            {
                _dbContext.AuditLogs.Add(new AuditLog
                {
                    UserId = userId,
                    ReportId = reportId,
                    Action = isExport ? "EXPORT_REPORT" : "PRINT_REPORT",
                    Result = "SUCCESS",
                    Details = isExport ? "使用者下載 Saved Data 報表 PDF。" : "使用者開啟 Saved Data 報表列印。",
                    CreatedAt = DateTime.UtcNow
                });
                await _dbContext.SaveChangesAsync();
                return File(pdfBytes, "application/pdf", $"report-{reportId}.pdf");
            }

            // Preview-only users receive images rather than the original PDF.
            return Ok(await _previewImages.CreateAsync(pdfBytes, userId));
        }
        catch (Exception ex)
        {
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new
                {
                    success = false,
                    message =
                        "產生報表預覽失敗。",
                    detail =
                        ex.Message
                });
        }
    }

    [HttpPatch("{reportId:long}/status")]
    [Authorize(Policy = "Report.EnableDisable")]
    public async Task<IActionResult> UpdateReportStatus(
        long reportId,
    [FromBody] UpdateReportStatusRequest request)
    {
        // 取得目前登入者的角色
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        // 檢查是否有啟用／停用報表的權限
        var allowed =
            await _reportService.CanEnableDisableReportAsync(
                reportId,
                roleCodes);

        if (!allowed)
        {
            return Forbid();
        }

        // 取得目前登入者 UserId
        var userIdValue =
            User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!long.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        // 查詢報表
        var report =
            await _dbContext.Reports
                .FirstOrDefaultAsync(
                    x => x.ReportId == reportId);

        if (report == null)
        {
            return NotFound(new
            {
                success = false,
                message = "找不到指定的報表。"
            });
        }

        if (request.IsEnabled)
        {
            if (!string.Equals(
                    report.ConfigurationStatus,
                    "Ready",
                    StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "報表參數尚未完成設定，不能啟用。"
                });
            }

            if (string.IsNullOrWhiteSpace(report.RptFilePath) ||
                !System.IO.File.Exists(report.RptFilePath))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "找不到報表 RPT 檔案，不能啟用。"
                });
            }

            // Reports without a data source are intentionally executed from
            // their embedded Saved Data. Their RPT parameters are not live-query
            // inputs, so they must not block activation.
            var hasInvalidParameter = report.DataSourceId.HasValue &&
                await _dbContext.ReportParameters
                    .AnyAsync(parameter =>
                        parameter.ReportId == reportId &&
                        (
                            !parameter.IsConfigured ||
                            (
                                parameter.ValueSourceType == "SqlLov" &&
                                parameter.LovConfig == null
                            )
                        ));

            if (hasInvalidParameter)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "仍有尚未完成設定的報表參數，不能啟用。"
                });
            }
        }

        // 修改啟用狀態
        report.IsEnabled = request.IsEnabled;
        report.UpdatedBy = userId;
        report.UpdatedAt = DateTime.UtcNow;

        // 寫入操作紀錄
        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            ReportId = reportId,
            Action = request.IsEnabled
                ? "ENABLE_REPORT"
                : "DISABLE_REPORT",
            Result = "SUCCESS",
            Details = request.IsEnabled
                ? $"啟用報表：{report.ReportName}"
                : $"停用報表：{report.ReportName}",
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            reportId = report.ReportId,
            reportName = report.ReportName,
            isEnabled = report.IsEnabled,
            message = request.IsEnabled
                ? "報表已啟用。"
                : "報表已停用。"
        });
    }
}
