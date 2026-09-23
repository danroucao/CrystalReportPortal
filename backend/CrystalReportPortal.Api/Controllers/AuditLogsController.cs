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
    public async Task<
        ActionResult<AuditLogListResponse>>
        GetAuditLogs(
            [FromQuery] AuditLogQueryRequest request)
    {
        var archiveBoundary = DateTime.UtcNow.AddDays(-180);
        var canViewArchive = User.HasClaim(
            "Permission",
            PermissionCodes.AuditLogViewArchive);

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

        var query =
            _dbContext.AuditLogs
                .AsNoTracking()
                .AsQueryable();

        if (request.UserId.HasValue)
        {
            query = query.Where(log =>
                log.UserId == request.UserId.Value);
        }

        if (request.ReportId.HasValue)
        {
            query = query.Where(log =>
                log.ReportId ==
                    request.ReportId.Value);
        }

        if (!string.IsNullOrWhiteSpace(
                request.Action))
        {
            var action =
                request.Action.Trim();

            query = query.Where(log =>
                log.Action == action);
        }

        if (!string.IsNullOrWhiteSpace(
                request.Result))
        {
            var result =
                request.Result.Trim();

            query = query.Where(log =>
                log.Result == result);
        }

        if (!string.IsNullOrWhiteSpace(
                request.IpAddress))
        {
            var ipAddress =
                request.IpAddress.Trim();

            query = query.Where(log =>
                log.IpAddress == ipAddress);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();

            query = query.Where(log =>
                (log.User != null &&
                    (log.User.Account.Contains(search) ||
                     log.User.UserName.Contains(search))) ||
                (log.Report != null &&
                    (log.Report.ReportCode.Contains(search) ||
                     log.Report.ReportName.Contains(search))) ||
                log.Action.Contains(search) ||
                log.Result.Contains(search) ||
                (log.Details != null && log.Details.Contains(search)) ||
                (log.ErrorMessage != null && log.ErrorMessage.Contains(search)) ||
                (log.IpAddress != null && log.IpAddress.Contains(search)));
        }

        if (request.FromUtc.HasValue)
        {
            var fromUtc =
                EnsureUtc(request.FromUtc.Value);

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
            query = query.Where(log =>
                log.CreatedAt >= archiveBoundary);
        }

        if (request.ToUtc.HasValue)
        {
            var toUtc =
                EnsureUtc(request.ToUtc.Value);

            if (!canViewArchive &&
                toUtc < archiveBoundary)
            {
                return Forbid();
            }

            query = query.Where(log =>
                log.CreatedAt <= toUtc);
        }

        var totalCount =
            await query.CountAsync();

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
            DateTimeKind.Utc => value,

            DateTimeKind.Local =>
                value.ToUniversalTime(),

            _ => DateTime.SpecifyKind(
                value,
                DateTimeKind.Utc)
        };
    }
}
