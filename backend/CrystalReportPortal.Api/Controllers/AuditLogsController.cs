using CrystalReportPortal.Api.Authorization;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Policy = PermissionCodes.AuditLogView)]
public class AuditLogsController : ControllerBase
{
    private const int MaximumPageSize = 100;

    private readonly AppDbContext _dbContext;

    public AuditLogsController(
        AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<AuditLogListResponse>>
        GetAuditLogs(
            [FromQuery] AuditLogQueryRequest request)
    {
        // 180 天的分界線
        var archiveBoundary =
            DateTime.UtcNow.AddDays(-180);

        // 判斷目前登入者有沒有查看 180 天以前紀錄的權限
        var canViewArchive =
            User.HasClaim(
                "Permission",
                PermissionCodes.AuditLogViewArchive);

        // =================================================
        // 驗證分頁參數
        // =================================================

        if (request.Page < 1)
        {
            return BadRequest(new
            {
                message = "Page 必須大於或等於 1。"
            });
        }

        if (request.PageSize < 1 ||
            request.PageSize > MaximumPageSize)
        {
            return BadRequest(new
            {
                message =
                    $"PageSize 必須介於 1 至 " +
                    $"{MaximumPageSize} 之間。"
            });
        }

        // =================================================
        // 驗證日期
        // =================================================

        if (request.FromUtc.HasValue &&
            request.ToUtc.HasValue &&
            request.FromUtc.Value >
                request.ToUtc.Value)
        {
            return BadRequest(new
            {
                message =
                    "FromUtc 不可晚於 ToUtc。"
            });
        }

        // =================================================
        // 建立查詢
        // =================================================

        var query =
            _dbContext.AuditLogs
                .AsNoTracking()
                .AsQueryable();

        // =================================================
        // 使用者篩選
        // =================================================

        if (request.UserId.HasValue)
        {
            query = query.Where(log =>
                log.UserId ==
                request.UserId.Value);
        }

        // =================================================
        // 報表篩選
        // =================================================

        if (request.ReportId.HasValue)
        {
            query = query.Where(log =>
                log.ReportId ==
                request.ReportId.Value);
        }

        // =================================================
        // Action 篩選
        // =================================================

        if (!string.IsNullOrWhiteSpace(
                request.Action))
        {
            var action =
                request.Action.Trim();

            query = query.Where(log =>
                log.Action == action);
        }

        // =================================================
        // Result 篩選
        // =================================================

        if (!string.IsNullOrWhiteSpace(
                request.Result))
        {
            var result =
                request.Result.Trim();

            query = query.Where(log =>
                log.Result == result);
        }

        // =================================================
        // IP 篩選
        // =================================================

        if (!string.IsNullOrWhiteSpace(
                request.IpAddress))
        {
            var ipAddress =
                request.IpAddress.Trim();

            query = query.Where(log =>
                log.IpAddress == ipAddress);
        }

        // =================================================
        // FromUtc
        // =================================================

        if (request.FromUtc.HasValue)
        {
            var fromUtc =
                EnsureUtc(
                    request.FromUtc.Value);

            // 沒有歷史紀錄權限
            // 卻要求查 180 天以前
            if (!canViewArchive &&
                fromUtc < archiveBoundary)
            {
                return Forbid();
            }

            query = query.Where(log =>
                log.CreatedAt >= fromUtc);
        }
        else if (!canViewArchive)
        {
            // 沒指定 FromUtc
            // 又沒有歷史權限
            // 預設只能看到最近 180 天
            query = query.Where(log =>
                log.CreatedAt >= archiveBoundary);
        }

        // =================================================
        // ToUtc
        // =================================================

        if (request.ToUtc.HasValue)
        {
            var toUtc =
                EnsureUtc(
                    request.ToUtc.Value);

            // 如果指定的結束日期本身就在 180 天以前
            // 而且沒有 Archive 權限
            if (!canViewArchive &&
                toUtc < archiveBoundary)
            {
                return Forbid();
            }

            query = query.Where(log =>
                log.CreatedAt <= toUtc);
        }

        // =================================================
        // 計算總筆數
        // =================================================

        var totalCount =
            await query.CountAsync();

        // =================================================
        // 分頁與 DTO
        // =================================================

        var items =
            await query
                .OrderByDescending(log =>
                    log.CreatedAt)
                .ThenByDescending(log =>
                    log.AuditLogId)
                .Skip(
                    (request.Page - 1) *
                    request.PageSize)
                .Take(request.PageSize)
                .Select(log =>
                    new AuditLogDto
                    {
                        AuditLogId =
                            log.AuditLogId,

                        UserId =
                            log.UserId,

                        UserAccount =
                            log.User == null
                                ? null
                                : log.User.Account,

                        UserName =
                            log.User == null
                                ? null
                                : log.User.UserName,

                        ReportId =
                            log.ReportId,

                        ReportCode =
                            log.Report == null
                                ? null
                                : log.Report.ReportCode,

                        ReportName =
                            log.Report == null
                                ? null
                                : log.Report.ReportName,

                        ExecutionId =
                            log.ExecutionId,

                        PrinterId =
                            log.PrinterId,

                        PrinterName =
                            log.Printer == null
                                ? null
                                : log.Printer.DisplayName,

                        Action =
                            log.Action,

                        Result =
                            log.Result,

                        Details =
                            log.Details,

                        ErrorMessage =
                            log.ErrorMessage,

                        IpAddress =
                            log.IpAddress,

                        CreatedAt =
                            log.CreatedAt
                    })
                .ToListAsync();

        // =================================================
        // 計算總頁數
        // =================================================

        var totalPages =
            totalCount == 0
                ? 0
                : (int)Math.Ceiling(
                    totalCount /
                    (double)request.PageSize);

        return Ok(
            new AuditLogListResponse
            {
                Page = request.Page,
                PageSize = request.PageSize,
                TotalCount = totalCount,
                TotalPages = totalPages,
                Items = items
            });
    }

    private static DateTime EnsureUtc(
        DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc =>
                value,

            DateTimeKind.Local =>
                value.ToUniversalTime(),

            _ =>
                DateTime.SpecifyKind(
                    value,
                    DateTimeKind.Utc)
        };
    }
}