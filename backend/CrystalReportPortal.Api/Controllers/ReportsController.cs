using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
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
    private readonly AppDbContext _dbContext;

    public ReportsController(
        IReportService reportService,
        ICrystalProcessService crystalProcessService,
        AppDbContext dbContext)
    {
        _reportService = reportService;
        _crystalProcessService = crystalProcessService;
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

        if (!allowed)
        {
            return Forbid();
        }

        var result =
            await _reportService.GetParameterOptionsAsync(
                reportId,
                parameterId,
                roleCodes);

        return Ok(result);
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

        var result =
            await _reportService.UploadRptAsync(
                reportId,
                file,
                userId);

        return Ok(result);
    }

    [HttpGet("{reportId:long}/preview")]
    public async Task<IActionResult> PreviewReport(
    long reportId)
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
            var pdfBytes =
                await _crystalProcessService
                    .PreviewAsync(
                        report.RptFilePath);

            return File(
                pdfBytes,
                "application/pdf");
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