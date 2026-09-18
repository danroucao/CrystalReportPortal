using System.Security.Claims;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/backoffice/reports")]
[Authorize]
public class AdminReportsController : ControllerBase
{
    private static readonly string[] ManagementPermissionCodes =
    {
        "Report.Upload",
        "Report.Maintain",
        "Report.SetParameters",
        "Report.EnableDisable"
    };

    private readonly AppDbContext _dbContext;

    public AdminReportsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<AdminReportDto>>> GetReports()
    {
        var roleCodes = GetRoleCodes();
        if (roleCodes.Count == 0)
        {
            return Forbid();
        }

        var canAccessManagement = await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .AnyAsync(permission =>
                roleCodes.Contains(permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                (permission.CanUpload ||
                 permission.CanMaintain ||
                 permission.CanSetParameters ||
                 permission.CanEnableDisable));

        if (!canAccessManagement)
        {
            return Forbid();
        }

        var reports = await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .Where(permission =>
                roleCodes.Contains(permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                (permission.CanUpload ||
                 permission.CanMaintain ||
                 permission.CanSetParameters ||
                 permission.CanEnableDisable))
            .Select(permission => permission.Report)
            .Distinct()
            .OrderBy(report => report.ReportName)
            .Select(report => new AdminReportDto
            {
                ReportId = report.ReportId,
                ReportCode = report.ReportCode,
                ReportName = report.ReportName,
                Description = report.Description,
                CategoryId = report.CategoryId,
                CategoryName = report.Category.CategoryName,
                DataSourceId = report.DataSourceId,
                DataSourceName = report.DataSource == null
                    ? null
                    : report.DataSource.DataSourceName,
                CredentialType = report.CredentialType,
                IsEnabled = report.IsEnabled,
                ConfigurationStatus = report.ConfigurationStatus,
                RptFileName = report.RptFileName,
                CreatedAt = report.CreatedAt,
                UpdatedAt = report.UpdatedAt
            })
            .ToListAsync();

        return Ok(reports);
    }

    [HttpGet("categories")]
    [Authorize(Policy = "Report.Upload")]
    public async Task<ActionResult<IReadOnlyList<CategoryOptionDto>>> GetCategories()
    {
        return Ok(await _dbContext.ReportCategories
            .AsNoTracking()
            .Where(category => category.IsEnabled)
            .OrderBy(category => category.DisplayOrder)
            .ThenBy(category => category.CategoryName)
            .Select(category => new CategoryOptionDto
            {
                CategoryId = category.CategoryId,
                CategoryName = category.CategoryName
            })
            .ToListAsync());
    }

    [HttpGet("data-sources")]
    [Authorize(Policy = "Report.Upload")]
    public async Task<ActionResult<IReadOnlyList<DataSourceOptionDto>>> GetDataSources()
    {
        return Ok(await _dbContext.ReportDataSources
            .AsNoTracking()
            .Where(dataSource => dataSource.IsEnabled)
            .OrderBy(dataSource => dataSource.DataSourceName)
            .Select(dataSource => new DataSourceOptionDto
            {
                DataSourceId = dataSource.DataSourceId,
                DataSourceName = dataSource.DataSourceName
            })
            .ToListAsync());
    }

    [HttpPost]
    [Authorize(Policy = "Report.Upload")]
    public async Task<ActionResult<AdminReportDto>> CreateReport(
        CreateReportRequest request)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var reportCode = request.ReportCode.Trim();
        var reportName = request.ReportName.Trim();
        if (string.IsNullOrWhiteSpace(reportCode) ||
            string.IsNullOrWhiteSpace(reportName))
        {
            return BadRequest(new { message = "報表代碼與報表名稱為必填。" });
        }

        if (!string.Equals(
                request.CredentialType,
                "ReadOnly",
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "目前僅允許使用 ReadOnly 憑證。" });
        }

        if (await _dbContext.Reports.AnyAsync(
                report => report.ReportCode == reportCode))
        {
            return Conflict(new { message = "報表代碼已存在。" });
        }

        var category = await _dbContext.ReportCategories
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate =>
                candidate.CategoryId == request.CategoryId &&
                candidate.IsEnabled);
        if (category == null)
        {
            return BadRequest(new { message = "報表分類無效或已停用。" });
        }

        var dataSource = request.DataSourceId.HasValue
            ? await _dbContext.ReportDataSources
                .AsNoTracking()
                .SingleOrDefaultAsync(candidate =>
                    candidate.DataSourceId == request.DataSourceId.Value &&
                    candidate.IsEnabled)
            : null;
        if (request.DataSourceId.HasValue && dataSource == null)
        {
            return BadRequest(new { message = "資料來源無效或已停用。" });
        }

        var roleCodes = GetRoleCodes();
        var managementRoles = await _dbContext.Roles
            .AsNoTracking()
            .Where(role => roleCodes.Contains(role.RoleCode) && role.IsEnabled)
            .Select(role => new
            {
                role.RoleId,
                PermissionCodes = role.RolePermissions
                    .Where(rolePermission => rolePermission.Permission.IsEnabled)
                    .Select(rolePermission => rolePermission.Permission.PermissionCode)
                    .ToList()
            })
            .ToListAsync();

        managementRoles = managementRoles
            .Where(role => role.PermissionCodes.Any(
                permissionCode => ManagementPermissionCodes.Contains(permissionCode)))
            .ToList();

        if (managementRoles.Count == 0)
        {
            return Forbid();
        }

        var now = DateTime.UtcNow;
        var report = new Report
        {
            ReportCode = reportCode,
            ReportName = reportName,
            Description = NullIfWhiteSpace(request.Description),
            CategoryId = request.CategoryId,
            DataSourceId = request.DataSourceId,
            CredentialType = "ReadOnly",
            RptFileName = string.Empty,
            RptFilePath = string.Empty,
            IsEnabled = false,
            ConfigurationStatus = "Draft",
            CreatedBy = userId,
            CreatedAt = now
        };

        _dbContext.Reports.Add(report);

        foreach (var role in managementRoles)
        {
            var permissions = role.PermissionCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
            _dbContext.RoleReportPermissions.Add(new RoleReportPermission
            {
                RoleId = role.RoleId,
                Report = report,
                CanExecute = false,
                CanExport = false,
                CanPrint = false,
                CanUpload = permissions.Contains("Report.Upload"),
                CanMaintain = permissions.Contains("Report.Maintain"),
                CanSetParameters = permissions.Contains("Report.SetParameters"),
                CanEnableDisable = permissions.Contains("Report.EnableDisable"),
                CreatedAt = now
            });
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Report = report,
            Action = "CREATE_REPORT",
            Result = "SUCCESS",
            Details = $"建立報表草稿：{reportCode}",
            CreatedAt = now
        });

        await _dbContext.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, new AdminReportDto
        {
            ReportId = report.ReportId,
            ReportCode = report.ReportCode,
            ReportName = report.ReportName,
            Description = report.Description,
            CategoryId = report.CategoryId,
            CategoryName = category.CategoryName,
            DataSourceId = report.DataSourceId,
            DataSourceName = dataSource?.DataSourceName,
            CredentialType = report.CredentialType,
            IsEnabled = report.IsEnabled,
            ConfigurationStatus = report.ConfigurationStatus,
            RptFileName = report.RptFileName,
            CreatedAt = report.CreatedAt,
            UpdatedAt = report.UpdatedAt
        });
    }

    [HttpDelete("{reportId:long}")]
    [Authorize(Policy = "Report.Maintain")]
    public async Task<IActionResult> DeleteReport(long reportId)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var report = await _dbContext.Reports
            .SingleOrDefaultAsync(item => item.ReportId == reportId);
        if (report == null)
        {
            return NotFound(new { message = "找不到指定的報表。" });
        }

        var hasExecutions = await _dbContext.ReportExecutions
            .AnyAsync(item => item.ReportId == reportId);
        if (hasExecutions)
        {
            return Conflict(new
            {
                message = "此報表已有執行紀錄，為保留稽核資料不可刪除；請先停用報表。"
            });
        }

        var reportPath = report.RptFilePath;
        var reportAuditLogs = await _dbContext.AuditLogs
            .Where(item => item.ReportId == reportId)
            .ToListAsync();
        _dbContext.AuditLogs.RemoveRange(reportAuditLogs);
        _dbContext.Reports.Remove(report);
        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "DELETE_REPORT",
            Result = "SUCCESS",
            Details = $"刪除報表：{report.ReportCode}",
            CreatedAt = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(reportPath) && System.IO.File.Exists(reportPath))
        {
            try { System.IO.File.Delete(reportPath); } catch { }
        }

        return NoContent();
    }

    private List<string> GetRoleCodes()
    {
        return User.FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private bool TryGetUserId(out long userId)
    {
        return long.TryParse(
            User.FindFirstValue(ClaimTypes.NameIdentifier),
            out userId);
    }

    private static string? NullIfWhiteSpace(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
