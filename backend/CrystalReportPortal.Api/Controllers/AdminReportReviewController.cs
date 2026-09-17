using System.Security.Claims;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/backoffice/reports/{reportId:long}")]
[Authorize(Policy = "Report.Maintain")]
public class AdminReportReviewController : ControllerBase
{
    private const string TestPreviewAction = "TEST_PREVIEW_REPORT";
    private const string ApproveAction = "APPROVE_REPORT_CONFIGURATION";

    private readonly AppDbContext _dbContext;
    private readonly ICredentialProtector _credentialProtector;
    private readonly ICrystalExportProcessService _crystalExport;

    public AdminReportReviewController(
        AppDbContext dbContext,
        ICredentialProtector credentialProtector,
        ICrystalExportProcessService crystalExport)
    {
        _dbContext = dbContext;
        _credentialProtector = credentialProtector;
        _crystalExport = crystalExport;
    }

    [HttpPost("test-preview")]
    public async Task<IActionResult> TestPreview(
        long reportId,
        ReportExecutionRequest request)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (!await CanMaintainReportAsync(userId, reportId))
        {
            return Forbid();
        }

        var report = await _dbContext.Reports
            .AsNoTracking()
            .Include(candidate => candidate.DataSource)
                .ThenInclude(dataSource => dataSource.Credentials)
            .Include(candidate => candidate.ReportParameters)
            .SingleOrDefaultAsync(candidate => candidate.ReportId == reportId);

        if (report == null)
        {
            return NotFound(new { message = "找不到指定的報表。" });
        }

        if (!string.Equals(
                report.ConfigurationStatus,
                "PendingReview",
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = "只有 PendingReview 狀態的報表可以執行管理端測試預覽。"
            });
        }

        if (string.IsNullOrWhiteSpace(report.RptFilePath) ||
            !System.IO.File.Exists(report.RptFilePath))
        {
            return BadRequest(new { message = "找不到報表 RPT 檔案。" });
        }

        if (!report.DataSource.IsEnabled)
        {
            return BadRequest(new { message = "報表資料來源目前未啟用。" });
        }

        try
        {
            var exportRequest = await BuildExportRequestAsync(report, userId, request);
            var pdf = await _crystalExport.ExportPdfAsync(exportRequest);
            var now = DateTime.UtcNow;

            AddAuditLog(
                userId,
                reportId,
                TestPreviewAction,
                "SUCCESS",
                $"報表 {report.ReportCode} 測試預覽成功。",
                null,
                now);

            await _dbContext.SaveChangesAsync();

            Response.Headers.Append("X-Report-Test-Preview", "true");

            return File(
                pdf,
                "application/pdf",
                $"report-{reportId}-test-preview.pdf");
        }
        catch (ArgumentException exception)
        {
            await WriteFailedPreviewAuditAsync(userId, reportId, report.ReportCode, exception);
            return BadRequest(new { message = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            await WriteFailedPreviewAuditAsync(userId, reportId, report.ReportCode, exception);
            return BadRequest(new { message = exception.Message });
        }
        catch (Exception exception)
        {
            await WriteFailedPreviewAuditAsync(userId, reportId, report.ReportCode, exception);
            throw;
        }
    }

    [HttpPost("configuration/approve")]
    public async Task<IActionResult> ApproveConfiguration(long reportId)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (!await CanMaintainReportAsync(userId, reportId))
        {
            return Forbid();
        }

        var report = await _dbContext.Reports
            .Include(candidate => candidate.ReportParameters)
                .ThenInclude(parameter => parameter.LovConfig)
            .SingleOrDefaultAsync(candidate => candidate.ReportId == reportId);

        if (report == null)
        {
            return NotFound(new { message = "找不到指定的報表。" });
        }

        if (!string.Equals(
                report.ConfigurationStatus,
                "PendingReview",
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = "只有 PendingReview 狀態的報表可以確認設定。"
            });
        }

        var hasIncompleteParameter = report.ReportParameters.Any(parameter =>
            !parameter.IsConfigured ||
            (string.Equals(parameter.ValueSourceType, "SqlLov", StringComparison.OrdinalIgnoreCase) &&
             parameter.LovConfig == null));

        if (hasIncompleteParameter)
        {
            return BadRequest(new { message = "仍有尚未完成設定的報表參數。" });
        }

        if (string.IsNullOrWhiteSpace(report.RptFilePath) ||
            !System.IO.File.Exists(report.RptFilePath))
        {
            return BadRequest(new { message = "找不到報表 RPT 檔案。" });
        }

        var configurationChangedAt =
            report.UpdatedAt ?? report.CreatedAt;

        var hasSuccessfulPreview = await _dbContext.AuditLogs
            .AsNoTracking()
            .AnyAsync(log =>
                log.ReportId == reportId &&
                log.UserId == userId &&
                log.Action == TestPreviewAction &&
                log.Result == "SUCCESS" &&
                log.CreatedAt >= configurationChangedAt);

        if (!hasSuccessfulPreview)
        {
            return BadRequest(new
            {
                message = "請先使用目前設定成功產生測試預覽 PDF，再確認報表設定。"
            });
        }

        var now = DateTime.UtcNow;
        report.ConfigurationStatus = "Ready";
        report.IsEnabled = false;
        report.UpdatedBy = userId;
        report.UpdatedAt = now;

        AddAuditLog(
            userId,
            reportId,
            ApproveAction,
            "SUCCESS",
            $"報表 {report.ReportCode} 的參數與預覽版面已確認。",
            null,
            now);

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            reportId,
            configurationStatus = report.ConfigurationStatus,
            isEnabled = report.IsEnabled,
            message = "報表設定已確認；請由具備啟停權限的人員啟用報表。"
        });
    }

    private async Task<CrystalExportProcessRequest> BuildExportRequestAsync(
        Report report,
        long userId,
        ReportExecutionRequest request)
    {
        var supplied = (request.Parameters ?? new List<ReportExecutionParameterRequest>())
            .GroupBy(parameter => parameter.ParameterId)
            .ToDictionary(
                group => group.Key,
                group => (group.Last().Values ?? new List<string>())
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .ToList());

        var reportParameters = report.ReportParameters
            .ToDictionary(parameter => parameter.ParameterId);

        if (supplied.Keys.Any(parameterId => !reportParameters.ContainsKey(parameterId)))
        {
            throw new ArgumentException("包含不屬於此報表的參數。");
        }

        var employeeNo = await _dbContext.Users
            .Where(user => user.UserId == userId)
            .Select(user => user.EmployeeNo)
            .SingleAsync();

        var exportParameters = new List<CrystalExportProcessParameter>();

        foreach (var parameter in report.ReportParameters)
        {
            var values = supplied.GetValueOrDefault(parameter.ParameterId) ?? new List<string>();

            if (string.Equals(
                    parameter.ValueSourceType,
                    "CurrentUser",
                    StringComparison.OrdinalIgnoreCase))
            {
                values = new List<string> { employeeNo };
            }

            if (parameter.IsRequired && values.Count == 0)
            {
                throw new ArgumentException($"參數「{parameter.DisplayName}」為必填。");
            }

            if (values.Count > 0)
            {
                exportParameters.Add(new CrystalExportProcessParameter
                {
                    Name = parameter.ParameterName,
                    DataType = parameter.DataType,
                    Values = values
                });
            }
        }

        var credential = report.DataSource.Credentials
            .FirstOrDefault(candidate =>
                string.Equals(
                    candidate.CredentialType,
                    report.CredentialType,
                    StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException(
                $"資料來源尚未設定 {report.CredentialType} 憑證。");

        var integratedSecurity = string.Equals(
            credential.AuthenticationType,
            "Windows",
            StringComparison.OrdinalIgnoreCase);

        string username;
        string password;

        if (integratedSecurity)
        {
            username = string.Empty;
            password = string.Empty;
        }
        else if (string.Equals(
                     credential.AuthenticationType,
                     "SqlServer",
                     StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(credential.Username) ||
                string.IsNullOrWhiteSpace(credential.EncryptedPassword))
            {
                throw new InvalidOperationException("SQL Server Authentication 憑證不完整。");
            }

            username = credential.Username;
            password = _credentialProtector.Unprotect(credential.EncryptedPassword);
        }
        else
        {
            throw new InvalidOperationException(
                $"不支援的資料庫驗證方式：{credential.AuthenticationType}");
        }

        return new CrystalExportProcessRequest
        {
            RptPath = report.RptFilePath,
            Database = new CrystalExportDatabase
            {
                Server = $"{report.DataSource.ServerHost},{report.DataSource.Port}",
                Database = report.DataSource.DatabaseName,
                IntegratedSecurity = integratedSecurity,
                Username = username,
                Password = password
            },
            Parameters = exportParameters
        };
    }

    private async Task<bool> CanMaintainReportAsync(long userId, long reportId)
    {
        return await _dbContext.UserRoles
            .AsNoTracking()
            .AnyAsync(userRole =>
                userRole.UserId == userId &&
                userRole.Role.IsEnabled &&
                userRole.Role.RoleReportPermissions.Any(permission =>
                    permission.ReportId == reportId &&
                    permission.CanMaintain));
    }

    private async Task WriteFailedPreviewAuditAsync(
        long userId,
        long reportId,
        string reportCode,
        Exception exception)
    {
        AddAuditLog(
            userId,
            reportId,
            TestPreviewAction,
            "FAILED",
            $"報表 {reportCode} 測試預覽失敗。",
            exception.Message,
            DateTime.UtcNow);

        await _dbContext.SaveChangesAsync();
    }

    private void AddAuditLog(
        long userId,
        long reportId,
        string action,
        string result,
        string details,
        string? errorMessage,
        DateTime createdAt)
    {
        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            ReportId = reportId,
            Action = action,
            Result = result,
            Details = details,
            ErrorMessage = errorMessage,
            CreatedAt = createdAt
        });
    }

    private bool TryGetUserId(out long userId)
    {
        return long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
    }
}
