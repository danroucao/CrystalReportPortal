using System.Security.Claims;
using System.Text.Json;
using CrystalReportPortal.Api.Authorization;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using CrystalReportPortal.Api.Services;
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
    private readonly ICrystalProcessService _crystalProcessService;

    public AdminReportsController(
        AppDbContext dbContext,
        ICrystalProcessService crystalProcessService)
    {
        _dbContext = dbContext;
        _crystalProcessService = crystalProcessService;
    }

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<AdminReportDto>>> GetReports(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc)
    {
        var archiveBoundary = DateTime.UtcNow.AddDays(-180);
        var canViewArchive = User.HasClaim(
            "Permission",
            PermissionCodes.ReportViewArchive);

        if (fromUtc.HasValue && toUtc.HasValue && fromUtc.Value > toUtc.Value)
        {
            return BadRequest(new { message = "開始日期不可晚於結束日期。" });
        }

        if (!canViewArchive &&
            ((fromUtc.HasValue && fromUtc.Value.ToUniversalTime() < archiveBoundary) ||
             (toUtc.HasValue && toUtc.Value.ToUniversalTime() < archiveBoundary)))
        {
            return Forbid();
        }

        if (!await CanAccessManagementAsync())
        {
            return Forbid();
        }

        var roleCodes = GetRoleCodes();
        var accessibleCategoryIds = _dbContext.RoleCategoryPermissions
            .AsNoTracking()
            .Where(permission =>
                roleCodes.Contains(permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.CanExecute)
            .Select(permission => permission.CategoryId)
            .Distinct();

        var reportQuery = _dbContext.Reports
            .AsNoTracking()
            .Where(report => accessibleCategoryIds.Contains(report.CategoryId));

        // Archived records remain in the database. They are only included
        // when an explicit date range reaches beyond the default 180-day view.
        reportQuery = fromUtc.HasValue
            ? reportQuery.Where(report => report.CreatedAt >= fromUtc.Value.ToUniversalTime())
            : reportQuery.Where(report => report.CreatedAt >= archiveBoundary);

        if (toUtc.HasValue)
        {
            reportQuery = reportQuery.Where(report => report.CreatedAt <= toUtc.Value.ToUniversalTime());
        }

        var reports = await reportQuery
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
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<CategoryOptionDto>>> GetCategories()
    {
        if (!await CanAccessManagementAsync()) return Forbid();

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

    [HttpGet("categories/manage")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<ManagedCategoryDto>>> GetManagedCategories()
    {
        if (!await CanAccessManagementAsync()) return Forbid();

        return Ok(await _dbContext.ReportCategories
            .AsNoTracking()
            .OrderBy(category => category.DisplayOrder)
            .ThenBy(category => category.CategoryName)
            .Select(category => new ManagedCategoryDto
            {
                CategoryId = category.CategoryId,
                CategoryName = category.CategoryName,
                ReportCount = category.Reports.Count
            })
            .ToListAsync());
    }

    [HttpPost("categories")]
    [Authorize(Policy = "Report.Maintain")]
    public async Task<ActionResult<ManagedCategoryDto>> CreateCategory(SaveReportCategoryRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var name = request.CategoryName.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { message = "請輸入分類名稱。" });
        }

        if (await _dbContext.ReportCategories.AnyAsync(category => category.CategoryName == name))
        {
            return Conflict(new { message = "此分類名稱已存在。" });
        }

        var now = DateTime.UtcNow;
        var category = new ReportCategory
        {
            CategoryName = name,
            DisplayOrder = (await _dbContext.ReportCategories.MaxAsync(category => (int?)category.DisplayOrder) ?? 0) + 1,
            IsEnabled = true,
            CreatedAt = now
        };
        _dbContext.ReportCategories.Add(category);
        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "CREATE_REPORT_CATEGORY",
            Result = "SUCCESS",
            Details = $"新增報表分類：{name}",
            CreatedAt = now
        });
        await _dbContext.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, new ManagedCategoryDto
        {
            CategoryId = category.CategoryId,
            CategoryName = category.CategoryName,
            ReportCount = 0
        });
    }

    [HttpPut("categories/{categoryId:int}")]
    [Authorize(Policy = "Report.Maintain")]
    public async Task<ActionResult<ManagedCategoryDto>> UpdateCategory(int categoryId, SaveReportCategoryRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var name = request.CategoryName.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { message = "請輸入分類名稱。" });

        var category = await _dbContext.ReportCategories.SingleOrDefaultAsync(item => item.CategoryId == categoryId);
        if (category == null) return NotFound(new { message = "找不到指定的報表分類。" });

        if (await _dbContext.ReportCategories.AnyAsync(item => item.CategoryId != categoryId && item.CategoryName == name))
        {
            return Conflict(new { message = "此分類名稱已存在。" });
        }

        category.CategoryName = name;
        category.UpdatedAt = DateTime.UtcNow;
        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "UPDATE_REPORT_CATEGORY",
            Result = "SUCCESS",
            Details = $"更新報表分類：{name}",
            CreatedAt = category.UpdatedAt.Value
        });
        await _dbContext.SaveChangesAsync();

        return Ok(new ManagedCategoryDto { CategoryId = category.CategoryId, CategoryName = category.CategoryName, ReportCount = await _dbContext.Reports.CountAsync(report => report.CategoryId == categoryId) });
    }

    [HttpDelete("categories/{categoryId:int}")]
    [Authorize(Policy = "Report.Maintain")]
    public async Task<IActionResult> DeleteCategory(int categoryId)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var category = await _dbContext.ReportCategories.SingleOrDefaultAsync(item => item.CategoryId == categoryId);
        if (category == null) return NotFound(new { message = "找不到指定的報表分類。" });

        var reportCount = await _dbContext.Reports.CountAsync(report => report.CategoryId == categoryId);
        if (reportCount > 0)
        {
            return Conflict(new { message = $"此分類仍有 {reportCount} 份報表使用中，無法刪除。" });
        }

        var now = DateTime.UtcNow;
        _dbContext.ReportCategories.Remove(category);
        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "DELETE_REPORT_CATEGORY",
            Result = "SUCCESS",
            Details = $"刪除報表分類：{category.CategoryName}",
            CreatedAt = now
        });
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("data-sources")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<DataSourceOptionDto>>> GetDataSources()
    {
        if (!await CanAccessManagementAsync()) return Forbid();

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

    [HttpGet("{reportId:long}/column-header-mappings")]
    [Authorize(Policy = "Report.Maintain")]
    public async Task<ActionResult<IReadOnlyList<ReportColumnHeaderMappingDto>>> GetColumnHeaderMappings(long reportId)
    {
        var report = await _dbContext.Reports.SingleOrDefaultAsync(report => report.ReportId == reportId);
        if (report == null) return NotFound(new { message = "找不到報表。" });

        List<ReportColumnHeaderMappingDto> mappings;
        try
        {
            mappings = JsonSerializer.Deserialize<List<ReportColumnHeaderMappingDto>>(
                report.ColumnHeaderMappingsJson) ?? [];
        }
        catch (JsonException)
        {
            mappings = [];
        }

        // Existing reports may have been uploaded before a newer Crystal object
        // type was supported. Refresh candidates and preserve saved translations.
        if (System.IO.File.Exists(report.RptFilePath))
        {
            try
            {
                var detected = await _crystalProcessService.GetHeaderTextsAsync(report.RptFilePath);
                var current = mappings.ToDictionary(item => item.SourceText,
                    StringComparer.OrdinalIgnoreCase);
                mappings = detected.Select(sourceText => new ReportColumnHeaderMappingDto
                    {
                        SourceText = sourceText,
                        DisplayName = current.TryGetValue(sourceText, out var mapping)
                            ? mapping.DisplayName : string.Empty
                    })
                    .ToList();
                report.ColumnHeaderMappingsJson = JsonSerializer.Serialize(mappings);
                await _dbContext.SaveChangesAsync();
            }
            catch
            {
                // A manual mapping remains available when an old RPT cannot be inspected.
            }
        }

        return Ok(mappings);
    }

    [HttpPut("{reportId:long}/column-header-mappings")]
    [Authorize(Policy = "Report.Maintain")]
    public async Task<ActionResult<IReadOnlyList<ReportColumnHeaderMappingDto>>> SaveColumnHeaderMappings(
        long reportId,
        SaveReportColumnHeaderMappingsRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var report = await _dbContext.Reports.SingleOrDefaultAsync(item => item.ReportId == reportId);
        if (report == null) return NotFound(new { message = "找不到報表。" });

        var mappings = (request.Mappings ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item.SourceText))
            .Select(item => new ReportColumnHeaderMappingDto
            {
                SourceText = item.SourceText.Trim(),
                DisplayName = item.DisplayName?.Trim() ?? string.Empty
            })
            .Where(item => item.SourceText.Length <= 300 && item.DisplayName.Length <= 120)
            .GroupBy(item => item.SourceText, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.Last())
            .ToList();

        var replacements = mappings
            .Where(item => !string.IsNullOrWhiteSpace(item.DisplayName))
            .ToDictionary(item => item.SourceText, item => item.DisplayName,
                StringComparer.OrdinalIgnoreCase);
        if (replacements.Count > 0 && System.IO.File.Exists(report.RptFilePath))
        {
            var localizedPath = GetLocalizedRptPath(report.RptFilePath);
            var temporaryPath = Path.ChangeExtension(localizedPath, ".pending.rpt");
            try
            {
                await _crystalProcessService.CreateLocalizedTemplateAsync(
                    report.RptFilePath, temporaryPath, replacements);
                System.IO.File.Move(temporaryPath, localizedPath, true);
            }
            finally
            {
                if (System.IO.File.Exists(temporaryPath)) System.IO.File.Delete(temporaryPath);
            }
        }
        else if (System.IO.File.Exists(GetLocalizedRptPath(report.RptFilePath)))
        {
            System.IO.File.Delete(GetLocalizedRptPath(report.RptFilePath));
        }

        report.ColumnHeaderMappingsJson = JsonSerializer.Serialize(mappings);
        report.UpdatedAt = DateTime.UtcNow;
        report.UpdatedBy = userId;
        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            ReportId = reportId,
            Action = "UPDATE_REPORT_COLUMN_HEADERS",
            Result = "SUCCESS",
            Details = $"Updated {mappings.Count} report column-header mappings.",
            CreatedAt = report.UpdatedAt.Value
        });
        await _dbContext.SaveChangesAsync();
        return Ok(mappings);
    }

    private static string GetLocalizedRptPath(string rptPath)
    {
        return Path.Combine(
            Path.GetDirectoryName(rptPath) ?? string.Empty,
            Path.GetFileNameWithoutExtension(rptPath) + ".localized.rpt");
    }

    [HttpGet("{reportId:long}/permissions")]
    [Authorize(Policy = "Report.Maintain")]
    public async Task<ActionResult<IReadOnlyList<RoleReportPermissionDto>>> GetReportPermissions(long reportId)
    {
        var report = await _dbContext.Reports
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.ReportId == reportId);
        if (report == null)
        {
            return NotFound(new { message = "找不到指定的報表。" });
        }

        var roles = await _dbContext.Roles
            .AsNoTracking()
            .Where(role => role.IsEnabled)
            .OrderBy(role => role.RoleName)
            .Select(role => new { role.RoleId, role.RoleCode, role.RoleName })
            .ToListAsync();

        var permissions = await _dbContext.RoleCategoryPermissions
            .AsNoTracking()
            .Where(permission => permission.CategoryId == report.CategoryId)
            .ToDictionaryAsync(permission => permission.RoleId);

        return Ok(roles.Select(role =>
        {
            permissions.TryGetValue(role.RoleId, out var permission);
            return new RoleReportPermissionDto
            {
                RoleId = role.RoleId,
                RoleCode = role.RoleCode,
                RoleName = role.RoleName,
                ReportId = report.ReportId,
                ReportCode = report.ReportCode,
                ReportName = report.ReportName,
                CanExecute = permission?.CanExecute ?? false,
                CanExport = permission?.CanExport ?? false,
                CanPrint = permission?.CanPrint ?? false,
                CanUpload = false,
                CanMaintain = false,
                CanSetParameters = false,
                CanEnableDisable = false
            };
        }).ToList());
    }

    [HttpPut("{reportId:long}/permissions/{roleId:int}")]
    [Authorize(Policy = "Report.Maintain")]
    public async Task<ActionResult<RoleReportPermissionDto>> UpdateReportPermission(
        long reportId,
        int roleId,
        UpdateRoleReportPermissionRequest request)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var role = await _dbContext.Roles.SingleOrDefaultAsync(item => item.RoleId == roleId && item.IsEnabled);
        var report = await _dbContext.Reports
            .Include(item => item.Category)
            .SingleOrDefaultAsync(item => item.ReportId == reportId);
        if (role == null) return NotFound(new { message = "找不到啟用中的角色。" });
        if (report == null) return NotFound(new { message = "找不到指定的報表。" });

        var permission = await _dbContext.RoleCategoryPermissions
            .SingleOrDefaultAsync(item => item.RoleId == roleId && item.CategoryId == report.CategoryId);
        var now = DateTime.UtcNow;
        if (permission == null)
        {
            permission = new RoleCategoryPermission
            {
                RoleId = roleId,
                CategoryId = report.CategoryId,
                CreatedAt = now
            };
            _dbContext.RoleCategoryPermissions.Add(permission);
        }

        permission.CanExecute = request.CanExecute;
        permission.CanExport = request.CanExecute && request.CanExport;
        permission.CanPrint = request.CanExecute && request.CanPrint;
        permission.UpdatedAt = now;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            ReportId = reportId,
            Action = "UPDATE_REPORT_PERMISSION",
            Result = "SUCCESS",
            Details = $"更新角色 {role.RoleCode} 對報表分類 {report.Category.CategoryName} 的使用權限。",
            CreatedAt = now
        });
        await _dbContext.SaveChangesAsync();

        return Ok(new RoleReportPermissionDto
        {
            RoleId = role.RoleId,
            RoleCode = role.RoleCode,
            RoleName = role.RoleName,
            ReportId = report.ReportId,
            ReportCode = report.ReportCode,
            ReportName = report.ReportName,
            CanExecute = permission.CanExecute,
            CanExport = permission.CanExport,
            CanPrint = permission.CanPrint,
            CanUpload = false,
            CanMaintain = false,
            CanSetParameters = false,
            CanEnableDisable = false
        });
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

        if (await _dbContext.ReportExecutions.AnyAsync(item => item.ReportId == reportId))
        {
            return Conflict(new
            {
                message = "此報表已有執行紀錄，為保留稽核資料無法刪除；請改為停用報表。"
            });
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

    private Task<bool> CanAccessManagementAsync()
    {
        // 功能權限決定是否能進入管理功能；報表分類權限則決定可看到
        // 哪些分類的報表。不要再依賴舊的逐報表管理權限資料，否則新建
        // 角色即使已勾選「報表管理」仍會被拒絕。
        return Task.FromResult(ManagementPermissionCodes.Any(
            permissionCode => User.HasClaim("Permission", permissionCode)));
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
