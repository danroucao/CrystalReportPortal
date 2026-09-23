using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using CrystalReportPortal.Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/backoffice/report-permissions")]
[Authorize(Policy = PermissionCodes.ReportMaintain)]
public class RoleReportPermissionsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public RoleReportPermissionsController(
        AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpPut("roles/{roleId:int}/reports/{reportId:long}")]
    public async Task<IActionResult> UpdatePermission(
        int roleId,
        long reportId,
        UpdateRoleReportPermissionRequest request)
    {
        var role = await _dbContext.Roles
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.RoleId == roleId);

        if (role == null)
        {
            return NotFound(new
            {
                message = "找不到指定的角色"
            });
        }

        var report = await _dbContext.Reports
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.ReportId == reportId);

        if (report == null)
        {
            return NotFound(new
            {
                message = "找不到指定的報表"
            });
        }

        var permission =
            await _dbContext.RoleReportPermissions
                .SingleOrDefaultAsync(
                    candidate =>
                        candidate.RoleId == roleId &&
                        candidate.ReportId == reportId);

        var now = DateTime.UtcNow;

        if (permission == null)
        {
            permission = new RoleReportPermission
            {
                RoleId = roleId,
                ReportId = reportId,
                CreatedAt = now
            };

            _dbContext.RoleReportPermissions.Add(
                permission);
        }

        permission.CanExecute =
            request.CanExecute;

        permission.CanExport =
            request.CanExport;

        permission.CanPrint =
            request.CanPrint;

        permission.CanUpload =
            request.CanUpload;

        permission.CanMaintain =
            request.CanMaintain;

        permission.CanSetParameters =
            request.CanSetParameters;

        permission.CanEnableDisable =
            request.CanEnableDisable;

        permission.UpdatedAt = now;

        var operatorIdText =
            HttpContext.Session.GetString(
                "BackOffice.OperatorUserId")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!long.TryParse(
                operatorIdText,
                out var operatorId))
        {
            return Unauthorized();
        }

        _dbContext.AuditLogs.Add(
            new AuditLog
            {
                UserId = operatorId,
                ReportId = reportId,
                Action = "UPDATE_REPORT_PERMISSION",
                Result = "SUCCESS",
                Details =
                    $"角色 {role.RoleCode} 的報表權限已更新",
                CreatedAt = now
            });

        await _dbContext.SaveChangesAsync();

        return Ok(
            new RoleReportPermissionDto
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
                CanUpload = permission.CanUpload,
                CanMaintain = permission.CanMaintain,
                CanSetParameters =
                    permission.CanSetParameters,
                CanEnableDisable =
                    permission.CanEnableDisable
            });
    }

    [HttpGet("roles/{roleId:int}/reports")]
    public async Task<IActionResult> GetPermissions(int roleId)
    {
        var role = await _dbContext.Roles
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.RoleId == roleId);

        if (role == null)
        {
            return NotFound(new
            {
                message = "找不到指定的角色"
            });
        }

        var reports = await _dbContext.Reports
            .AsNoTracking()
            .OrderBy(report => report.ReportName)
            .Select(report => new
            {
                report.ReportId,
                report.ReportCode,
                report.ReportName,
                report.IsEnabled
            })
            .ToListAsync();

        var permissions = await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .Where(item => item.RoleId == roleId)
            .ToDictionaryAsync(item => item.ReportId);

        var result = reports.Select(report =>
        {
            permissions.TryGetValue(
                report.ReportId,
                out var permission);

            return new
            {
                role.RoleId,
                role.RoleCode,
                role.RoleName,

                report.ReportId,
                report.ReportCode,
                report.ReportName,
                report.IsEnabled,

                CanExecute = permission?.CanExecute ?? false,
                CanExport = permission?.CanExport ?? false,
                CanPrint = permission?.CanPrint ?? false,
                CanUpload = permission?.CanUpload ?? false,
                CanMaintain = permission?.CanMaintain ?? false,
                CanSetParameters =
                    permission?.CanSetParameters ?? false,
                CanEnableDisable =
                    permission?.CanEnableDisable ?? false
            };
        }).ToList();

        return Ok(result);
    }
}